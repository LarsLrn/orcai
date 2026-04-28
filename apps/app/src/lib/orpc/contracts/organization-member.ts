import { base } from "@orcai/contracts";
import { organizationIdSchema, paginationInputSchema } from "@orcai/schema";
import { z } from "zod/v4";
import {
	organizationMemberDeleteSchema,
	organizationMemberInsertSchema,
	organizationMemberSelectSchema,
	organizationMemberUpdateSchema,
} from "@/lib/orpc/schemas/organization-member";

export const listOrganizationMembersContract = base
	.route({
		method: "GET",
		path: "/organizations/{organizationId}/members",
		summary: "List all members of an organization",
		tags: [
			"Organization Members",
		],
	})
	.input(
		paginationInputSchema.extend({
			organizationId: organizationIdSchema,
		}),
	)
	.output(
		z.object({
			data: z.array(organizationMemberSelectSchema),
			rowCount: z.number(),
		}),
	);

export const createOrganizationMemberContract = base
	.route({
		method: "POST",
		path: "/organizations/{organizationId}/members",
		summary: "Create a member for an organization",
		tags: [
			"Organization Members",
		],
	})
	.input(organizationMemberInsertSchema)
	.output(
		z.object({
			data: organizationMemberSelectSchema,
		}),
	);

export const findOrganizationMemberContract = base
	.route({
		method: "GET",
		path: "/organizations/{organizationId}/members/{userId}",
		summary: "Find a member of an organization",
		tags: [
			"Organization Members",
		],
	})
	.input(
		organizationMemberSelectSchema.pick({
			userId: true,
			organizationId: true,
		}),
	)
	.output(
		z.object({
			data: organizationMemberSelectSchema,
		}),
	);

export const updateOrganizationMemberContract = base
	.route({
		method: "PUT",
		path: "/organizations/{organizationId}/members/{userId}",
		summary: "Update a member of an organization",
		tags: [
			"Organization Members",
		],
	})
	.errors({
		NOT_FOUND: {
			message: "Member not found",
			data: z.object({
				organizationId: organizationMemberUpdateSchema.shape.organizationId,
				userId: organizationMemberUpdateSchema.shape.userId,
			}),
		},
	})
	.input(organizationMemberUpdateSchema)
	.output(
		z.object({
			data: organizationMemberSelectSchema,
		}),
	);

export const deleteOrganizationMemberContract = base
	.route({
		method: "DELETE",
		path: "/organizations/{organizationId}/members",
		summary: "Delete a member of an organization",
		tags: [
			"Organization Members",
		],
	})
	.input(organizationMemberDeleteSchema)
	.output(
		z.object({
			success: z.boolean(),
			message: z.string().optional(),
		}),
	);
