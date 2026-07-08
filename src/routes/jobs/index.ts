import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { z } from 'zod';
import { runPriceJob } from '../../services/priceJob.ts';
import { accepted, jobError, jobStatus } from './schemas.ts';

type LastRun = z.infer<typeof jobStatus>['lastRun'];

const routes: FastifyPluginAsyncZod = async (app) => {
	let running = false;
	let lastRun: LastRun = null;

	app.post(
		'/prices',
		{
			onRequest: app.authenticate,
			schema: { response: { 202: accepted, 409: jobError, 503: jobError } }
		},
		(request, reply) => {
			const parserUrl = process.env.PARSER_URL;
			if (!parserUrl) {
				reply.code(503);
				return { message: 'PARSER_URL is not set' };
			}
			if (running) {
				reply.code(409);
				return { message: 'Price job is already running' };
			}

			running = true;
			const startedAt = new Date().toISOString();
			runPriceJob(app.db, app.log, parserUrl)
				.then((stats) => {
					lastRun = { ...stats, startedAt, finishedAt: new Date().toISOString() };
				})
				.catch((error) => app.log.error(error))
				.finally(() => {
					running = false;
				});

			reply.code(202);
			return { ok: true as const };
		}
	);

	app.get(
		'/prices',
		{ onRequest: app.authenticate, schema: { response: { 200: jobStatus } } },
		() => ({ running, lastRun })
	);
};

export default routes;
