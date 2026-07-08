import { z } from 'zod';

export const registerBody = z.looseObject({
	token: z.string().optional(),
	response: z.looseObject({}).optional()
});

export const loginBody = z.looseObject({
	id: z.string().optional(),
	response: z.unknown().optional()
});

export const okResponse = z.object({
	ok: z.literal(true)
});

export const sessionInfo = z.object({
	authenticated: z.boolean(),
	needsSetup: z.boolean()
});
