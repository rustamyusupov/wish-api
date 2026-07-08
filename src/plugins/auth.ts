import cookie from '@fastify/cookie';
import fp from 'fastify-plugin';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { isSessionValid, isTokenValid, SESSION_COOKIE } from '../services/auth.ts';

export type AuthConfig = {
	secret: string;
	rpId: string;
	origin: string;
	secure: boolean;
	setupToken: string | undefined;
};

declare module 'fastify' {
	interface FastifyInstance {
		authConfig: AuthConfig;
		authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
	}

	interface FastifyRequest {
		authenticated: boolean;
	}
}

export default fp(
	async (app) => {
		const secret = process.env.SESSION_SECRET;
		if (!secret) throw new Error('SESSION_SECRET is not set');

		const rpId = process.env.RP_ID;
		if (!rpId) throw new Error('RP_ID is not set');

		const origin = process.env.ORIGIN;
		if (!origin) throw new Error('ORIGIN is not set');

		const apiToken = process.env.API_TOKEN;

		app.decorate('authConfig', {
			secret,
			rpId,
			origin,
			secure: origin.startsWith('https://'),
			setupToken: process.env.SETUP_TOKEN
		});

		await app.register(cookie);

		app.decorateRequest('authenticated', false);
		app.addHook('onRequest', async (request) => {
			const token = request.cookies[SESSION_COOKIE];
			request.authenticated = token !== undefined && isSessionValid(token, secret);
		});

		app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
			if (request.authenticated) return;

			const header = request.headers.authorization;
			const bearer = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
			if (bearer && apiToken && isTokenValid(bearer, apiToken)) return;

			await reply.code(401).send({ message: 'Unauthorized' });
		});
	},
	{ name: 'auth' }
);
