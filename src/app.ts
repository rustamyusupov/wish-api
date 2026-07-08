import path from 'node:path';
import autoload from '@fastify/autoload';
import fastify from 'fastify';

export const buildApp = async () => {
	const app = fastify({ logger: true });

	await app.register(autoload, {
		dir: path.join(import.meta.dirname, 'routes')
	});

	return app;
};
