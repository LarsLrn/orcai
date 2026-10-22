import {
	getProviderEndpointMode,
	getProviderPurpose,
	type ProviderKind,
} from "@orcai/core";
import { z } from "zod/v4";
import { organizationIdSchema } from "../organization/ref";
import type { ErrorReason } from "../shared/error-reason";
import { providerKindSchema } from "./parts/kind";
import {
	type ProviderMeteringMode,
	providerMeteringModeSchema,
} from "./parts/metering-mode";
import { providerIdSchema } from "./ref";

/** Why an endpoint does not suit a kind, or undefined when it does. */
export const providerEndpointIssue = (
	kind: ProviderKind,
	endpoint: string | null,
) => {
	switch (getProviderEndpointMode(kind)) {
		case "required":
			return endpoint === null
				? ("PROVIDER_ENDPOINT_REQUIRED" satisfies ErrorReason)
				: undefined;
		case "optional":
			return undefined;
		case "none":
			return endpoint === null
				? undefined
				: ("PROVIDER_ENDPOINT_NOT_ALLOWED" satisfies ErrorReason);
	}
};

/** Search providers meter requests: one per search. */
export const providerMeteringModeIssue = (
	kind: ProviderKind,
	meteringMode: ProviderMeteringMode,
) =>
	getProviderPurpose(kind) === "search" && meteringMode !== "requests"
		? ("PROVIDER_METERING_MODE_NOT_ALLOWED" satisfies ErrorReason)
		: undefined;

/** Rejects an endpoint or metering mode that does not suit the kind; a blank endpoint counts as none. */
export const checkProviderFields = (
	ctx: z.core.ParsePayload<{
		kind: ProviderKind;
		endpoint: string | null;
		meteringMode: ProviderMeteringMode;
	}>,
) => {
	const issues = [
		[
			"endpoint",
			providerEndpointIssue(ctx.value.kind, ctx.value.endpoint || null),
		],
		[
			"meteringMode",
			providerMeteringModeIssue(ctx.value.kind, ctx.value.meteringMode),
		],
	] as const;
	for (const [path, reason] of issues) {
		if (reason) {
			ctx.issues.push({
				code: "custom",
				params: {
					reason,
				},
				path: [
					path,
				],
				input: ctx.value,
			});
		}
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
	purpose: z
		.enum([
			"models",
			"search",
		])
		.optional(),
});

export type Provider = z.infer<typeof providerSchema>;
