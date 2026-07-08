import { setTimeout as sleep } from 'node:timers/promises';
import { asc, desc, eq } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import { z } from 'zod';
import { currencies, prices, wishes } from '../db/schema.ts';
import type { Db } from '../plugins/db.ts';

const RETRY_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = Number(process.env.JOB_RETRY_BACKOFF_MS ?? 15_000);
const PAUSE_MS = Number(process.env.JOB_PAUSE_MS ?? 10_000);
const PAUSE_AVITO_MS = Number(process.env.JOB_PAUSE_AVITO_MS ?? 45_000);
const PARSE_TIMEOUT_MS = 90_000;

const parseResult = z.looseObject({
	available: z.boolean(),
	amount: z.number().optional(),
	currencyCode: z.string().optional()
});

export type JobStats = {
	total: number;
	saved: number;
	unchanged: number;
	unavailable: number;
	failed: number;
};

const parseLink = async (parserUrl: string, link: string) => {
	const response = await fetch(`${parserUrl}/parse`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ url: link }),
		signal: AbortSignal.timeout(PARSE_TIMEOUT_MS)
	});
	if (!response.ok) throw new Error(`parser responded ${response.status}`);

	return parseResult.parse(await response.json());
};

const withRetry = async <T>(fn: () => Promise<T>): Promise<T> => {
	let lastError: unknown;
	for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt += 1) {
		try {
			return await fn();
		} catch (error) {
			lastError = error;
			if (attempt < RETRY_ATTEMPTS) await sleep(RETRY_BACKOFF_MS * attempt);
		}
	}
	throw lastError;
};

const pauseFor = (link: string) => (link.includes('avito.ru') ? PAUSE_AVITO_MS : PAUSE_MS);

export const runPriceJob = async (
	db: Db,
	log: FastifyBaseLogger,
	parserUrl: string
): Promise<JobStats> => {
	const rows = db
		.select({ id: wishes.id, name: wishes.name, link: wishes.link })
		.from(wishes)
		.orderBy(asc(wishes.id))
		.all();
	const currencyIds = new Map(
		db
			.select({ code: currencies.code, id: currencies.id })
			.from(currencies)
			.all()
			.map((currency) => [currency.code, currency.id])
	);

	const stats: JobStats = {
		total: rows.length,
		saved: 0,
		unchanged: 0,
		unavailable: 0,
		failed: 0
	};
	log.info(`price job started: ${stats.total} wishes`);

	for (const [index, wish] of rows.entries()) {
		try {
			const result = await withRetry(() => parseLink(parserUrl, wish.link));

			if (!result.available) {
				stats.unavailable += 1;
				log.info(`[${wish.id}] ${wish.name}: unavailable`);
			} else {
				if (result.amount === undefined || result.currencyCode === undefined)
					throw new Error('parser returned no price');

				const currencyId = currencyIds.get(result.currencyCode);
				if (!currencyId) throw new Error(`unknown currency: ${result.currencyCode}`);

				const last = db
					.select({ amount: prices.amount, currencyId: prices.currencyId })
					.from(prices)
					.where(eq(prices.wishId, wish.id))
					.orderBy(desc(prices.createdAt), desc(prices.id))
					.limit(1)
					.get();

				const currentAmount = last ? Math.round(last.amount * 100) / 100 : undefined;
				if (currentAmount === result.amount && last?.currencyId === currencyId) {
					stats.unchanged += 1;
					log.info(
						`[${wish.id}] ${wish.name}: unchanged (${result.amount} ${result.currencyCode})`
					);
				} else {
					db.insert(prices).values({ wishId: wish.id, amount: result.amount, currencyId }).run();
					stats.saved += 1;
					log.info(`[${wish.id}] ${wish.name}: ${result.amount} ${result.currencyCode}`);
				}
			}
		} catch (error) {
			stats.failed += 1;
			log.error(`[${wish.id}] ${wish.name}: ${error instanceof Error ? error.message : error}`);
		}

		if (index < rows.length - 1) await sleep(pauseFor(wish.link));
	}

	log.info(
		`price job finished: ${stats.saved} saved, ${stats.unchanged} unchanged, ${stats.unavailable} unavailable, ${stats.failed} failed`
	);
	return stats;
};
