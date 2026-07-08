import type { FastifyPluginAsync } from 'fastify';

const health: FastifyPluginAsync = async (app) => {
	app.get('/health', () => ({ status: 'ok' }));
};

export default health;
