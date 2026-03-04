import { z } from "zod/v4";
import { sharedSchemas } from "@/db/zod/shared";
import { organizationSelectSchema } from "@/lib/orpc/schemas/organization";
import {
	paginationSchema,
	statusSchema,
	zedTokenSchema,
} from "@/lib/orpc/schemas/shared";
import {
	userAccessEntrySchema,
	userSelectSchema,
	userWithOrganizationRoleSelectSchema,
} from "@/lib/orpc/schemas/user";
import { base } from "./base";

export const listUsersContract = base
	.route({
		method: "GET",
		path: "/users",
		summary: "List all users",
		tags: [
			"Users",
		],
	})
	.input(
		z.object({
			...paginationSchema.shape,
			...zedTokenSchema.shape,
		}),
	)
	.output(
		z.object({
			data: z.array(userWithOrganizationRoleSelectSchema),
			rowCount: z.number(),
		}),
	);

export const findUserContract = base
	.route({
		method: "GET",
		path: "/users/{id}",
		summary: "Find a user",
		tags: [
			"Users",
		],
		description: "Find a user by their ID.",
	})
	.input(
		z.object({
			id: userSelectSchema.shape.id,
			...zedTokenSchema.shape,
		}),
	)
	.output(
		z.object({
			data: userWithOrganizationRoleSelectSchema,
		}),
	);

export const listUserAccessContract = base
	.route({
		method: "GET",
		path: "/users/{id}/access",
		summary: "List effective resource access entries for a user",
		tags: [
			"Users",
		],
	})
	.input(
		z.object({
			id: userSelectSchema.shape.id,
			...zedTokenSchema.shape,
		}),
	)
	.output(
		z.object({
			data: z.array(userAccessEntrySchema),
			rowCount: z.number(),
		}),
	);

export const meContract = base
	.route({
		method: "GET",
		path: "/users/me",
		summary: "Get current user",
		tags: [
			"Users",
		],
		description: "Get the current user's data.",
	})
	.input(
		z.object({
			...zedTokenSchema.shape,
		}),
	)
	.output(
		z.object({
			data: userSelectSchema,
		}),
	);

export const updatePasswordContract = base
	.route({
		method: "POST",
		path: "/users/actions/password",
		summary: "Update user password",
		tags: [
			"Users",
		],
		description: "Update the password for a user.",
	})
	.input(
		z.object({
			currentPassword: sharedSchemas.password,
			password: sharedSchemas.password,
		}),
	)
	.output(statusSchema);

export const setActiveOrganizationContract = base
	.route({
		method: "POST",
		path: "/users/actions/set-active-organization",
		summary: "Set active organization",
		tags: [
			"Users",
		],
		description: "Set the active organization for a user.",
	})
	.input(
		z.object({
			organizationId: organizationSelectSchema.shape.id,
		}),
	)
	.output(statusSchema);

export const setTourStateContract = base
	.$route({
		method: "POST",
		path: "/users/actions/set-tour-state",
		summary: "Set tour state",
		tags: [
			"Users",
		],
		description: "Set the tour state for a user.",
	})
	.input(
		z.object({
			// TODO: Actually type this with enum
			tourId: z.string(),
			state: z.enum([
				"skipped",
				"completed",
				"pending",
			]),
		}),
	)
	.output(statusSchema);
