import {
	canReportCost,
	getProviderEndpointMode,
	getProviderPurpose,
	type ProviderKind,
} from "@orcai/core";
import { z } from "zod/v4";
import { organizationIdSchema } from "../organization/ref";
import type { ErrorReason } from "../shared/error-reason";
import { currencySchema, priceSchema } from "../shared/primitives/money";
import { providerKindSchema } from "./parts/kind";
import {
	type ProviderMeteringMode,
	providerMeteringModeSchema,
} from "./parts/metering-mode";
import { providerIdSchema } from "./ref";

/** Why an endpoint does not suit a kind, or undefined when it does. */
const providerEndpointIssue = (kind: ProviderKind, endpoint: string | null) => {
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
const providerMeteringModeIssue = (
	kind: ProviderKind,
	meteringMode: ProviderMeteringMode,
) =>
	getProviderPurpose(kind) === "search" && meteringMode !== "requests"
		? ("PROVIDER_METERING_MODE_NOT_ALLOWED" satisfies ErrorReason)
		: undefined;

/** The fields whose validity depends on the kind or on each other. */
type CheckedProviderFields = {
	kind: ProviderKind;
	endpoint: string | null;
	meteringMode: ProviderMeteringMode;
	currency: string;
	reportsCost: boolean;
	searchPrice: number | null;
};

type ProviderFieldIssue = [
	keyof CheckedProviderFields,
	Extract<
		ErrorReason,
		| "PROVIDER_ENDPOINT_REQUIRED"
		| "PROVIDER_ENDPOINT_NOT_ALLOWED"
		| "PROVIDER_METERING_MODE_NOT_ALLOWED"
		| "PROVIDER_COST_REPORTING_NOT_ALLOWED"
		| "PROVIDER_CURRENCY_NOT_ALLOWED"
		| "PROVIDER_SEARCH_PRICE_NOT_ALLOWED"
	>,
];

/** Each field that does not suit the provider, with why; a blank endpoint counts as none. */
export const providerFieldIssues = (
	fields: CheckedProviderFields,
): ProviderFieldIssue[] =>
	(
		[
			[
				"endpoint",
				providerEndpointIssue(fields.kind, fields.endpoint || null),
			],
			[
				"meteringMode",
				providerMeteringModeIssue(fields.kind, fields.meteringMode),
			],
			[
				"reportsCost",
				fields.reportsCost && !canReportCost(fields.kind)
					? "PROVIDER_COST_REPORTING_NOT_ALLOWED"
					: undefined,
			],
			// Reported costs are in USD.
			[
				"currency",
				fields.reportsCost && fields.currency !== "USD"
					? "PROVIDER_CURRENCY_NOT_ALLOWED"
					: undefined,
			],
			[
				"searchPrice",
				fields.searchPrice !== null &&
				getProviderPurpose(fields.kind) !== "search"
					? "PROVIDER_SEARCH_PRICE_NOT_ALLOWED"
					: undefined,
			],
		] satisfies [
			ProviderFieldIssue[0],
			ProviderFieldIssue[1] | undefined,
		][]
	).flatMap(([path, reason]): ProviderFieldIssue[] =>
		reason === undefined
			? []
			: [
					[
						path,
						reason,
					],
				],
	);

export const checkProviderFields = (
	ctx: z.core.ParsePayload<CheckedProviderFields>,
) => {
	for (const [path, reason] of providerFieldIssues(ctx.value)) {
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
};

export const providerFieldsSchema = z.object({
	name: z.string().min(1),
	description: z.string(),
	endpoint: z.url().nullable(),
	kind: providerKindSchema,
	meteringMode: providerMeteringModeSchema,
	currency: currencySchema.default("USD"),
	reportsCost: z.boolean().default(false),
	searchPrice: priceSchema.nullable().default(null),
	apiKey: z.string().trim().min(1),
	enabled: z.boolean().default(true),
});

/** The kind is fixed at creation; switching kind means a new provider. */
export const providerMutableFieldsSchema = providerFieldsSchema
	.omit({
		kind: true,
	})
	// Without their defaults, which would overwrite what an update leaves out.
	.extend({
		enabled: z.boolean(),
		currency: currencySchema,
		reportsCost: z.boolean(),
		searchPrice: priceSchema.nullable(),
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
