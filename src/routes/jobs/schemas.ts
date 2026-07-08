import { z } from 'zod';

export const accepted = z.object({
	ok: z.literal(true)
});

export const jobError = z.object({
	message: z.string()
});

export const jobStatus = z.object({
	running: z.boolean(),
	lastRun: z
		.object({
			startedAt: z.iso.datetime(),
			finishedAt: z.iso.datetime(),
			total: z.number().int(),
			saved: z.number().int(),
			unchanged: z.number().int(),
			unavailable: z.number().int(),
			failed: z.number().int()
		})
		.nullable()
});
