import { z } from "zod/v4";
import { base } from "./base";

export const createDocumentTaskContract = base
	.route({
		method: "POST",
		path: "/tasks/documents",
		summary: "Create a document task",
		tags: ["Tasks"],
	})
	.input(
		z.object({
			taskType: z.enum(["extract", "embed"]),
			ids: z.array(z.string()),
		}),
	)
	.output(z.object({ success: z.boolean(), message: z.string().optional() }));
