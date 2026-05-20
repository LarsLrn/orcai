import { z } from "zod/v4";
import { providerCompatibilitySchema } from "../fragments/provider-compatibility";
import { providerMeteringModeSchema } from "../fragments/provider-metering-mode";
import { organizationIdSchema } from "../organization/ref";
import { providerIdSchema } from "./ref";

export const providerFieldsSchema = z.object({
	name: z.string().min(1, "Name is required"),
	description: z.string(),
	endpoint: z.url({
		message: "Endpoint must be a valid URL",
	}),
	compatibility: providerCompatibilitySchema,
	meteringMode: providerMeteringModeSchema,
	apiKey: z.string().min(1, "API key is required"),
	enabled: z.boolean().default(true),
});

export const providerMutableFieldsSchema = providerFieldsSchema.partial();

export const providerSchema = providerFieldsSchema
	.omit({
		apiKey: true,
	})
	.extend({
		id: providerIdSchema,
		organizationId: organizationIdSchema,
		apiKeyEncrypted: z.string(),
		createdAt: z.coerce.date().nullable(),
		updatedAt: z.coerce.date().nullable(),
	});

export const providerFiltersSchema = z.object({
	enabled: providerSchema.shape.enabled.optional(),
});

export type Provider = z.infer<typeof providerSchema>;
