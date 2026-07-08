import { z } from 'zod';

export const wishListItem = z.object({
	id: z.number().int(),
	name: z.string(),
	link: z.string(),
	categoryId: z.number().int(),
	category: z.string(),
	sort: z.number().int(),
	amount: z.number().nullable(),
	symbol: z.string().nullable(),
	change: z
		.object({
			direction: z.enum(['up', 'down']),
			percent: z.number(),
			low: z.boolean()
		})
		.nullable()
});

export const wishParams = z.object({
	id: z.coerce.number().int().positive()
});

export const wishDetail = z.object({
	id: z.number().int(),
	name: z.string(),
	link: z.string(),
	categoryId: z.number().int(),
	sort: z.number().int(),
	createdAt: z.iso.datetime(),
	amount: z.number().nullable(),
	currencyId: z.number().int().nullable(),
	history: z.array(
		z.object({
			amount: z.number(),
			code: z.string(),
			symbol: z.string(),
			createdAt: z.iso.datetime()
		})
	)
});

export const notFound = z.object({
	message: z.string()
});
