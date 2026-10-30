export type ProviderEndpointMode = "required" | "optional" | "none";

/** What a provider serves: models to chat with, or web search. */
export type ProviderPurpose = "models" | "search";

/** Client-safe metadata, one entry per provider kind. */
export const providerKinds = [
	{
		kind: "openai-compatible",
		purpose: "models",
		endpointMode: "required",
		nativeWebSearch: false,
		reportsCost: true,
	},
	{
		kind: "openai",
		purpose: "models",
		endpointMode: "none",
		nativeWebSearch: true,
		reportsCost: false,
	},
	{
		kind: "anthropic",
		purpose: "models",
		endpointMode: "none",
		nativeWebSearch: true,
		reportsCost: false,
	},
	{
		kind: "tavily",
		purpose: "search",
		endpointMode: "optional",
		nativeWebSearch: false,
		reportsCost: false,
	},
] as const satisfies readonly {
	kind: string;
	purpose: ProviderPurpose;
	endpointMode: ProviderEndpointMode;
	/** The kind's models search the web with their provider's own tool. */
	nativeWebSearch: boolean;
	/** The kind's responses may carry their cost, as OpenRouter's do. */
	reportsCost: boolean;
}[];

type ProviderKindEntry = (typeof providerKinds)[number];

export type ProviderKind = ProviderKindEntry["kind"];
export type ModelProviderKind = Extract<
	ProviderKindEntry,
	{
		purpose: "models";
	}
>["kind"];
export type SearchProviderKind = Extract<
	ProviderKindEntry,
	{
		purpose: "search";
	}
>["kind"];

const entryOf = (kind: ProviderKind): ProviderKindEntry => {
	const entry = providerKinds.find((candidate) => candidate.kind === kind);
	if (!entry) {
		throw new Error(`Unknown provider kind ${kind}`);
	}
	return entry;
};

export const getProviderEndpointMode = (kind: ProviderKind) =>
	entryOf(kind).endpointMode;

export const getProviderPurpose = (kind: ProviderKind) => entryOf(kind).purpose;

export const isModelProviderKind = (
	kind: ProviderKind,
): kind is ModelProviderKind => getProviderPurpose(kind) === "models";

export const isSearchProviderKind = (
	kind: ProviderKind,
): kind is SearchProviderKind => getProviderPurpose(kind) === "search";

export const modelProviderKinds: ModelProviderKind[] = providerKinds
	.map((entry) => entry.kind)
	.filter(isModelProviderKind);

export const hasNativeWebSearch = (kind: ProviderKind) =>
	entryOf(kind).nativeWebSearch;

export const canReportCost = (kind: ProviderKind) => entryOf(kind).reportsCost;

export const modelCapabilities = [
	"text",
	"embedding",
	"image",
	"image-generation",
	"video",
	"audio",
	"audio-generation",
	"reasoning",
	"tool-calling",
] as const;

export const providerMeteringModes = [
	"tokens",
	"requests",
] as const;
