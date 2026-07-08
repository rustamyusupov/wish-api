import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { getWishDetail, listWishes } from '../../services/wishes.ts';
import { notFound, wishDetail, wishListItem, wishParams } from './schemas.ts';

const routes: FastifyPluginAsyncZod = async (app) => {
	app.get('', { schema: { response: { 200: z.array(wishListItem) } } }, () => listWishes(app.db));

	app.get(
		'/:id',
		{ schema: { params: wishParams, response: { 200: wishDetail, 404: notFound } } },
		(request, reply) => {
			const wish = getWishDetail(app.db, request.params.id);
			if (!wish) {
				reply.code(404);
				return { message: 'Wish not found' };
			}
			return wish;
		}
	);
};

export default routes;
