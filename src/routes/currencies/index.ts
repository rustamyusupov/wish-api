import { asc } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { currencies } from '../../db/schema.ts';
import { currency } from './schemas.ts';

const routes: FastifyPluginAsyncZod = async (app) => {
	app.get('', { schema: { response: { 200: z.array(currency) } } }, () =>
		app.db
			.select({ id: currencies.id, code: currencies.code, symbol: currencies.symbol })
			.from(currencies)
			.orderBy(asc(currencies.id))
			.all()
	);
};

export default routes;
