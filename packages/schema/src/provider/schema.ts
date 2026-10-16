import { z } from "zod/v4";
import { organizationIdSchema } from "../organization/ref";
import { providerCompatibilitySchema } from "./parts/compatibility";
import { providerMeteringModeSchema } from "./parts/metering-mode";
import { providerIdSchema } from "./ref";

export const providerFieldsSchema = z.object({
	name: z.string().min(1),
	description: z.string(),
	endpoint: z.url(),
	compatibility: providerCompatibilitySchema,
	meteringMode: providerMeteringModeSchema,
	apiKey: z.string().trim().min(1),
	enabled: z.boolean().default(true),
});

export const providerMutableFieldsSchema = providerFieldsSchema
	.extend({
		enabled: z.boolean(),
	})
	.partial();

export const providerSchema = providerFieldsSchema
	.omit({
		apiKey: true,
	})
	.extend({
		id: providerIdSchema,
		organizationId: organizationIdSchema,
		createdAt: z.coerce.date().nullable(),
		updatedAt: z.coerce.date().nullable(),
	});

export const providerFiltersSchema = z.object({
	enabled: providerSchema.shape.enabled.optional(),
});

export type Provider = z.infer<typeof providerSchema>;
