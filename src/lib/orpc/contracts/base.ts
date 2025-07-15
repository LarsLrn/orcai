import { oc } from "@orpc/contract";
import { z } from "zod/v4";

export const base = oc.errors({
	FORBIDDEN: {
		data: z.object({ allowed: z.boolean() }),
	},
});
