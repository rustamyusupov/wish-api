import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
	addPrice,
	categoryExists,
	createWish,
	currencyExists,
	deleteWish,
	getWishDetail,
	listWishes,
	previewWish,
	reorderWishes,
	updateWish
} from '../../services/wishes.ts';
import {
	created,
	notFound,
	okResponse,
	orderInput,
	previewInput,
	priceInput,
	wishDetail,
	wishInput,
	wishListItem,
	wishParams,
	wishPreview
} from './schemas.ts';

const badRequest = { message: z.string() };

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

	app.post(
		'/preview',
		{
			onRequest: app.authenticate,
			schema: {
				body: previewInput,
				response: {
					200: wishPreview,
					422: z.object(badRequest),
					502: z.object(badRequest),
					503: z.object(badRequest)
				}
			}
		},
		async (request, reply) => {
			const parserUrl = process.env.PARSER_URL;
			if (!parserUrl) {
				reply.code(503);
				return { message: 'PARSER_URL is not set' };
			}

			try {
				const result = await previewWish(app.db, parserUrl, request.body.url);
				if (!result.ok) {
					reply.code(422);
					return { message: result.message };
				}
				return result.preview;
			} catch (error) {
				reply.code(502);
				return { message: error instanceof Error ? error.message : String(error) };
			}
		}
	);

	app.post(
		'',
		{
			onRequest: app.authenticate,
			schema: { body: wishInput, response: { 201: created, 400: z.object(badRequest) } }
		},
		(request, reply) => {
			if (!categoryExists(app.db, request.body.categoryId)) {
				reply.code(400);
				return { message: 'Unknown category' };
			}
			if (!currencyExists(app.db, request.body.currencyId)) {
				reply.code(400);
				return { message: 'Unknown currency' };
			}

			reply.code(201);
			return { id: createWish(app.db, request.body) };
		}
	);

	app.put(
		'/order',
		{
			onRequest: app.authenticate,
			schema: { body: orderInput, response: { 200: okResponse, 400: z.object(badRequest) } }
		},
		(request, reply) => {
			if (!categoryExists(app.db, request.body.categoryId)) {
				reply.code(400);
				return { message: 'Unknown category' };
			}

			reorderWishes(app.db, request.body.categoryId, request.body.ids);
			return { ok: true as const };
		}
	);

	app.put(
		'/:id',
		{
			onRequest: app.authenticate,
			schema: {
				params: wishParams,
				body: wishInput,
				response: { 200: okResponse, 400: z.object(badRequest), 404: notFound }
			}
		},
		(request, reply) => {
			if (!categoryExists(app.db, request.body.categoryId)) {
				reply.code(400);
				return { message: 'Unknown category' };
			}
			if (!currencyExists(app.db, request.body.currencyId)) {
				reply.code(400);
				return { message: 'Unknown currency' };
			}

			if (!updateWish(app.db, request.params.id, request.body)) {
				reply.code(404);
				return { message: 'Wish not found' };
			}
			return { ok: true as const };
		}
	);

	app.delete(
		'/:id',
		{
			onRequest: app.authenticate,
			schema: { params: wishParams, response: { 200: okResponse, 404: notFound } }
		},
		(request, reply) => {
			if (!deleteWish(app.db, request.params.id)) {
				reply.code(404);
				return { message: 'Wish not found' };
			}
			return { ok: true as const };
		}
	);

	app.post(
		'/:id/prices',
		{
			onRequest: app.authenticate,
			schema: {
				params: wishParams,
				body: priceInput,
				response: { 201: okResponse, 400: z.object(badRequest), 404: notFound }
			}
		},
		(request, reply) => {
			if (!currencyExists(app.db, request.body.currencyId)) {
				reply.code(400);
				return { message: 'Unknown currency' };
			}

			if (!addPrice(app.db, request.params.id, request.body.amount, request.body.currencyId)) {
				reply.code(404);
				return { message: 'Wish not found' };
			}
			reply.code(201);
			return { ok: true as const };
		}
	);
};

export default routes;
