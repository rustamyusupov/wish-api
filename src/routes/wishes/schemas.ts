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

export const previewInput = z.object({
	url: z.url()
});

export const wishPreview = z.object({
	name: z.string().nullable(),
	link: z.string(),
	amount: z.number(),
	currencyId: z.number().int(),
	currencyCode: z.string(),
	symbol: z.string()
});

export const wishInput = z.object({
	name: z.string().trim().min(1),
	link: z.string().trim().min(1),
	categoryId: z.number().int().positive(),
	amount: z.number().nonnegative(),
	currencyId: z.number().int().positive()
});

export const orderInput = z.object({
	categoryId: z.number().int().positive(),
	ids: z.array(z.number().int().positive()).min(1)
});

export const priceInput = z.object({
	amount: z.number().nonnegative(),
	currencyId: z.number().int().positive()
});

export const created = z.object({
	id: z.number().int()
});

export const okResponse = z.object({
	ok: z.literal(true)
});
