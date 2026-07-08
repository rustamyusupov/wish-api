import { z } from 'zod';

export const currency = z.object({
	id: z.number().int(),
	code: z.string(),
	symbol: z.string()
});
