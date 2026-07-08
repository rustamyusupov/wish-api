import path from 'node:path';
import autoload from '@fastify/autoload';
import fastify from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';

export const buildApp = async () => {
	const app = fastify({ logger: true });

	app.setValidatorCompiler(validatorCompiler);
	app.setSerializerCompiler(serializerCompiler);

	await app.register(autoload, {
		dir: path.join(import.meta.dirname, 'plugins')
	});

	await app.register(autoload, {
		dir: path.join(import.meta.dirname, 'routes')
	});

	return app;
};
