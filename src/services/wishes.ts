import { asc, desc, eq, sql } from 'drizzle-orm';
import { categories, currencies, prices, wishes } from '../db/schema.ts';
import type { Db } from '../plugins/db.ts';
import { ParserError, parseLink } from './parser.ts';
import { priceChange } from './prices.ts';

export type WishInput = {
	name: string;
	link: string;
	categoryId: number;
	amount: number;
	currencyId: number;
};

export type WishPreview = {
	name: string | null;
	link: string;
	amount: number;
	currencyId: number;
	currencyCode: string;
	symbol: string;
};

export type PreviewResult = { ok: true; preview: WishPreview } | { ok: false; message: string };

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

export const categoryExists = (db: Db, id: number) =>
	db.select({ id: categories.id }).from(categories).where(eq(categories.id, id)).get() !==
	undefined;

export const currencyExists = (db: Db, id: number) =>
	db.select({ id: currencies.id }).from(currencies).where(eq(currencies.id, id)).get() !==
	undefined;

const getCurrencyByCode = (db: Db, code: string) =>
	db
		.select({ id: currencies.id, symbol: currencies.symbol })
		.from(currencies)
		.where(eq(currencies.code, code))
		.get();

export const previewWish = async (
	db: Db,
	parserUrl: string,
	url: string
): Promise<PreviewResult> => {
	let result;
	try {
		result = await parseLink(parserUrl, url);
	} catch (error) {
		if (error instanceof ParserError && error.status === 422)
			return { ok: false, message: 'Shop is not supported' };
		throw error;
	}

	if (!result.available) return { ok: false, message: 'Item is unavailable' };
	if (result.amount === undefined || result.currencyCode === undefined)
		return { ok: false, message: 'Parser returned no price' };

	const currency = getCurrencyByCode(db, result.currencyCode);
	if (!currency) return { ok: false, message: `Unknown currency: ${result.currencyCode}` };

	return {
		ok: true,
		preview: {
			name: result.name ?? null,
			link: url,
			amount: result.amount,
			currencyId: currency.id,
			currencyCode: result.currencyCode,
			symbol: currency.symbol
		}
	};
};

export const createWish = (db: Db, input: WishInput) =>
	db.transaction((tx) => {
		const { sort } = tx
			.select({ sort: sql<number>`coalesce(max(${wishes.sort}), -1) + 1` })
			.from(wishes)
			.where(eq(wishes.categoryId, input.categoryId))
			.get()!;

		const { id } = tx
			.insert(wishes)
			.values({
				categoryId: input.categoryId,
				name: input.name,
				link: input.link,
				sort
			})
			.returning({ id: wishes.id })
			.get();

		tx.insert(prices)
			.values({ wishId: id, amount: input.amount, currencyId: input.currencyId })
			.run();

		return id;
	});

export const updateWish = (db: Db, id: number, input: WishInput) =>
	db.transaction((tx) => {
		const wish = tx.select({ id: wishes.id }).from(wishes).where(eq(wishes.id, id)).get();
		if (!wish) return false;

		const last = tx
			.select({ amount: prices.amount, currencyId: prices.currencyId })
			.from(prices)
			.where(eq(prices.wishId, id))
			.orderBy(desc(prices.createdAt), desc(prices.id))
			.limit(1)
			.get();

		tx.update(wishes)
			.set({ name: input.name, link: input.link, categoryId: input.categoryId })
			.where(eq(wishes.id, id))
			.run();

		const currentAmount = last ? Math.round(last.amount * 100) / 100 : undefined;
		if (currentAmount !== input.amount || last?.currencyId !== input.currencyId) {
			tx.insert(prices)
				.values({ wishId: id, amount: input.amount, currencyId: input.currencyId })
				.run();
		}

		return true;
	});

export const addPrice = (db: Db, wishId: number, amount: number, currencyId: number) => {
	const wish = db.select({ id: wishes.id }).from(wishes).where(eq(wishes.id, wishId)).get();
	if (!wish) return false;

	db.insert(prices).values({ wishId, amount, currencyId }).run();
	return true;
};

export const reorderWishes = (db: Db, categoryId: number, ids: number[]) =>
	db.transaction((tx) => {
		ids.forEach((id, index) => {
			tx.update(wishes).set({ categoryId, sort: index }).where(eq(wishes.id, id)).run();
		});
	});

export const deleteWish = (db: Db, id: number) =>
	db.delete(wishes).where(eq(wishes.id, id)).run().changes > 0;
