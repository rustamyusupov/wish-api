import { asc, eq, sql } from 'drizzle-orm';
import { categories, currencies, prices, wishes } from '../db/schema.ts';
import type { Db } from '../plugins/db.ts';
import { priceChange } from './prices.ts';

export const listWishes = (db: Db) => {
	const rows = db
		.select({
			id: wishes.id,
			name: wishes.name,
			link: wishes.link,
			categoryId: wishes.categoryId,
			category: categories.name,
			sort: wishes.sort,
			amount: prices.amount,
			symbol: currencies.symbol
		})
		.from(wishes)
		.innerJoin(categories, eq(categories.id, wishes.categoryId))
		.leftJoin(
			prices,
			eq(
				prices.id,
				sql`(select id from prices where wish_id = ${wishes.id} order by created_at desc, id desc limit 1)`
			)
		)
		.leftJoin(currencies, eq(currencies.id, prices.currencyId))
		.orderBy(asc(categories.name), asc(wishes.sort), asc(wishes.name))
		.all();

	const priceRows = db
		.select({
			wishId: prices.wishId,
			amount: prices.amount,
			code: currencies.code,
			createdAt: prices.createdAt
		})
		.from(prices)
		.innerJoin(currencies, eq(currencies.id, prices.currencyId))
		.orderBy(asc(prices.createdAt), asc(prices.id))
		.all();

	const histories = new Map<number, typeof priceRows>();
	for (const price of priceRows) {
		const history = histories.get(price.wishId);
		if (history) history.push(price);
		else histories.set(price.wishId, [price]);
	}

	const now = new Date();
	return rows.map((row) => ({
		...row,
		change: priceChange(histories.get(row.id) ?? [], now)
	}));
};

export const getWishDetail = (db: Db, id: number) => {
	const wish = db.select().from(wishes).where(eq(wishes.id, id)).get();
	if (!wish) return null;

	const history = db
		.select({
			amount: prices.amount,
			currencyId: prices.currencyId,
			code: currencies.code,
			symbol: currencies.symbol,
			createdAt: prices.createdAt
		})
		.from(prices)
		.innerJoin(currencies, eq(currencies.id, prices.currencyId))
		.where(eq(prices.wishId, id))
		.orderBy(asc(prices.createdAt), asc(prices.id))
		.all();

	const last = history.at(-1);

	return {
		id: wish.id,
		name: wish.name,
		link: wish.link,
		categoryId: wish.categoryId,
		sort: wish.sort,
		createdAt: wish.createdAt.toISOString(),
		amount: last ? Math.round(last.amount * 100) / 100 : null,
		currencyId: last?.currencyId ?? null,
		history: history.map((point) => ({
			amount: point.amount,
			code: point.code,
			symbol: point.symbol,
			createdAt: point.createdAt.toISOString()
		}))
	};
};
