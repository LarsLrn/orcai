import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-zod";
import { z } from "zod/v4";
import { member } from "@/db/schema/organization";
import { paginationSchema } from "../schemas/shared";
import { base } from "./base";

export const organizationMemberSelectSchema = createSelectSchema(member);

export const organizationMemberInsertSchema = createInsertSchema(member).omit({
	createdAt: true,
});

export const organizationMemberUpdateSchema = createUpdateSchema(member, {
	organizationId: z.uuidv4(),
	userId: z.uuidv4(),
});

export const organizationMemberDeleteSchema = z.object({
	organizationId: z.uuidv4(),
	refs: z.array(organizationMemberUpdateSchema.pick({ userId: true })),
});

export const listOrganizationMembersContract = base
	.route({
		method: "GET",
		path: "/organizations/{organizationId}/members",
		summary: "List all members of an organization",
		tags: ["Organization Members"],
	})
	.input(
		paginationSchema.extend({
			organizationId: z.uuidv4(),
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
		tags: ["Organization Members"],
	})
	.input(organizationMemberInsertSchema)
	.output(z.object({ data: organizationMemberSelectSchema }));

export const findOrganizationMemberContract = base
	.route({
		method: "GET",
		path: "/organizations/{organizationId}/members/{userId}",
		summary: "Find a member of an organization",
		tags: ["Organization Members"],
	})
	.input(
		organizationMemberSelectSchema.pick({ userId: true, organizationId: true }),
	)
	.output(z.object({ data: organizationMemberSelectSchema }));

export const updateOrganizationMemberContract = base
	.route({
		method: "PUT",
		path: "/organizations/{organizationId}/members/{userId}",
		summary: "Update a member of an organization",
		tags: ["Organization Members"],
	})
	.errors({
		NOT_FOUND: {
			message: "Organization not found",
			data: z.object({ id: organizationMemberUpdateSchema.shape.id }),
		},
	})
	.input(organizationMemberUpdateSchema)
	.output(z.object({ data: organizationMemberSelectSchema }));

export const deleteOrganizationMemberContract = base
	.route({
		method: "DELETE",
		path: "/organizations/{organizationId}/members",
		summary: "Delete a member of an organization",
		tags: ["Organization Members"],
	})
	.input(organizationMemberDeleteSchema)
	.output(z.object({ success: z.boolean(), message: z.string().optional() }));
