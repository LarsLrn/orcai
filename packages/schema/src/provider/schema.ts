import { getProviderEndpointMode, type ProviderKind } from "@orcai/core";
import { z } from "zod/v4";
import { organizationIdSchema } from "../organization/ref";
import type { ErrorReason } from "../shared/error-reason";
import { providerKindSchema } from "./parts/kind";
import { providerMeteringModeSchema } from "./parts/metering-mode";
import { providerIdSchema } from "./ref";

/** Why an endpoint does not suit a kind, or undefined when it does. */
export const providerEndpointIssue = (
	kind: ProviderKind,
	endpoint: string | null,
) => {
	if (getProviderEndpointMode(kind) === "required") {
		return endpoint === null
			? ("PROVIDER_ENDPOINT_REQUIRED" satisfies ErrorReason)
			: undefined;
	}
	return endpoint === null
		? undefined
		: ("PROVIDER_ENDPOINT_NOT_ALLOWED" satisfies ErrorReason);
};

/** Rejects an endpoint that does not suit the kind; blank counts as none. */
export const checkProviderEndpoint = (
	ctx: z.core.ParsePayload<{
		kind: ProviderKind;
		endpoint: string | null;
	}>,
) => {
	const reason = providerEndpointIssue(
		ctx.value.kind,
		ctx.value.endpoint || null,
	);
	if (reason) {
		ctx.issues.push({
			code: "custom",
			params: {
				reason,
			},
			path: [
				"endpoint",
			],
			input: ctx.value,
		});
	}
};

export const providerFieldsSchema = z.object({
	name: z.string().min(1),
	description: z.string(),
	endpoint: z.url().nullable(),
	kind: providerKindSchema,
	meteringMode: providerMeteringModeSchema,
	apiKey: z.string().trim().min(1),
	enabled: z.boolean().default(true),
});

/** The kind is fixed at creation; switching kind means a new provider. */
export const providerMutableFieldsSchema = providerFieldsSchema
	.omit({
		kind: true,
	})
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
