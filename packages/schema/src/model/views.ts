import type { z } from "zod/v4";
import { providerSchema } from "../provider/schema";
import { modelSchema } from "./schema";

export const modelListRowSchema = modelSchema.extend({
	provider: providerSchema.pick({
		id: true,
		name: true,
	}),
});

export type ModelListRow = z.infer<typeof modelListRowSchema>;
