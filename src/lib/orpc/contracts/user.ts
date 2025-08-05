import { createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { user } from "@/db/schema/auth";
import { sharedSchemas } from "@/db/zod/shared";
import { paginationSchema } from "../schemas/shared";
import { base } from "./base";

const userSelectSchema = createSelectSchema(user);

export const listUsersContract = base
	.route({
		method: "GET",
		path: "/users",
		summary: "List all users",
		tags: ["Users"],
	})
	.input(paginationSchema)
	.output(z.object({ data: z.array(userSelectSchema), rowCount: z.number() }));

export const findUserContract = base
	.route({
		method: "GET",
		path: "/users/self",
		summary: "Find a user",
		tags: ["Users"],
		description:
			"Find a user by their ID. If no ID is provided, the current user's data is returned.",
	})
	.input(userSelectSchema.pick({ id: true }).optional())
	.output(z.object({ data: userSelectSchema }));

export const updatePasswordContract = base
	.route({
		method: "POST",
		path: "/users/actions/password",
		summary: "Update user password",
		tags: ["Users"],
		description: "Update the password for a user.",
	})
	.input(
		z.object({
			currentPassword: sharedSchemas.password,
			password: sharedSchemas.password,
		}),
	)
	.output(z.object({ success: z.boolean() }));

export const setActiveOrganizationContract = base
	.route({
		method: "POST",
		path: "/users/actions/set-active-organization",
		summary: "Set active organization",
		tags: ["Users"],
		description: "Set the active organization for a user.",
	})
	.input(
		z.object({
			organizationId: z.string().uuid(),
		}),
	)
	.output(z.object({ success: z.boolean() }));

export const setTourStateContract = base
	.$route({
		method: "POST",
		path: "/users/actions/set-tour-state",
		summary: "Set tour state",
		tags: ["Users"],
		description: "Set the tour state for a user.",
	})
	.input(
		z.object({
			// TODO: Actually type this with enum
			tourId: z.string(),
			state: z.enum(["skipped", "completed", "pending"]),
		}),
	)
	.output(z.object({ success: z.boolean() }));
