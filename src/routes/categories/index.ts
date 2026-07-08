import { asc } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { categories } from '../../db/schema.ts';
import { category } from './schemas.ts';

const routes: FastifyPluginAsyncZod = async (app) => {
	app.get('', { schema: { response: { 200: z.array(category) } } }, () =>
		app.db
			.select({ id: categories.id, name: categories.name })
			.from(categories)
			.orderBy(asc(categories.name))
			.all()
	);
};

export default routes;
