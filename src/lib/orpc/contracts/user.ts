import { createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { user } from "@/db/schema/auth";
import { sharedSchemas } from "@/db/zod/shared";
import { base } from "./base";

const userSelectSchema = createSelectSchema(user);

export const listUsersContract = base
	.route({
		method: "GET",
		path: "/users",
		summary: "List all users",
		tags: ["Users"],
	})
	.input(
		z.object({
			pageSize: z.number().int().min(1).max(100).default(10),
			pageIndex: z.number().int().min(0).default(0),
		}),
	)
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
		path: "/users/password",
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
