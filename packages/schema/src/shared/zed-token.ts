import { z } from "zod/v4";

export const zedTokenSchema = z.object({
	zedToken: z.string().optional(),
});

export const zedTokenMetaShape = {
	meta: zedTokenSchema.optional(),
};
