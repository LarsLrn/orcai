import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-zod";
import { z } from "zod/v4";
import { organization } from "@/db/schema/organization";
import { paginationSchema } from "../schemas/shared";
import { base } from "./base";

export const organizationSelectSchema = createSelectSchema(organization);

export const organizationInsertSchema = createInsertSchema(organization).omit({
	createdAt: true,
});

export const organizationUpdateSchema = createUpdateSchema(organization, {
	id: z.uuidv4(),
});

export const organizationDeleteSchema = z.object({
	refs: z.array(organizationUpdateSchema.pick({ id: true })),
});

export const listOrganizationsContract = base
	.route({
		method: "GET",
		path: "/organizations",
		summary: "List all organizations",
		tags: ["Organizations"],
	})
	.input(paginationSchema)
	.output(
		z.object({ data: z.array(organizationSelectSchema), rowCount: z.number() }),
	);

export const createOrganizationContract = base
	.route({
		method: "POST",
		path: "/organizations",
		summary: "Create an organization",
		tags: ["Organizations"],
	})
	.input(organizationInsertSchema)
	.output(z.object({ data: organizationSelectSchema }));

export const findOrganizationContract = base
	.route({
		method: "GET",
		path: "/organizations/{id}",
		summary: "Find an organization",
		tags: ["Organizations"],
	})
	/* .input(organizationSelectSchema.pick({ id: true })) */
	.input(organizationSelectSchema.pick({ id: true }))
	.output(z.object({ data: organizationSelectSchema }));

export const updateOrganizationContract = base
	.route({
		method: "PUT",
		path: "/organizations/{id}",
		summary: "Update an organization",
		tags: ["Organizations"],
	})
	.errors({
		NOT_FOUND: {
			message: "Organization not found",
			data: z.object({ id: organizationUpdateSchema.shape.id }),
		},
	})
	.input(organizationUpdateSchema)
	.output(z.object({ data: organizationSelectSchema }));

export const deleteOrganizationContract = base
	.route({
		method: "DELETE",
		path: "/organizations",
		summary: "Delete an organization",
		tags: ["Organizations"],
	})
	.input(organizationDeleteSchema)
	.output(z.object({ success: z.boolean(), message: z.string().optional() }));
