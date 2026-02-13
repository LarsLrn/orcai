import { z } from "zod/v4";
import {
	bootstrapInitializeSchema,
	bootstrapStatusSchema,
} from "@/lib/orpc/schemas/bootstrap";
import { base } from "./base";

export const bootstrapStatusContract = base
	.route({
		method: "GET",
		path: "/bootstrap/status",
		summary: "Get bootstrap status",
		tags: ["Bootstrap"],
	})
	.input(z.object({}))
	.output(z.object({ data: bootstrapStatusSchema }));

export const bootstrapInitializeContract = base
	.route({
		method: "POST",
		path: "/bootstrap/initialize",
		summary: "Initialize application",
		tags: ["Bootstrap"],
	})
	.input(bootstrapInitializeSchema)
	.output(
		z.object({
			data: z.object({
				userId: z.uuidv4(),
				organizationId: z.uuidv4(),
			}),
		}),
	);
