import { z } from "zod/v4";
import { base } from "./base";

export const createAssetTaskContract = base
	.route({
		method: "POST",
		path: "/tasks/assets",
		summary: "Create an asset task",
		tags: ["Tasks"],
	})
	.input(
		z.object({
			taskType: z.enum(["extract", "embed"]),
			ids: z.array(z.string()),
		}),
	)
	.output(z.object({ success: z.boolean(), message: z.string().optional() }));
