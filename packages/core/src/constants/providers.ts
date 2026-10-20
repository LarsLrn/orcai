export type ProviderEndpointMode = "required" | "none";

/** Client-safe metadata, one entry per provider kind. */
export const providerKinds = [
	{
		kind: "openai-compatible",
		endpointMode: "required",
	},
	{
		kind: "openai",
		endpointMode: "none",
	},
	{
		kind: "anthropic",
		endpointMode: "none",
	},
] as const satisfies readonly {
	kind: string;
	endpointMode: ProviderEndpointMode;
}[];

export type ProviderKind = (typeof providerKinds)[number]["kind"];

const endpointModes = Object.fromEntries(
	providerKinds.map((entry) => [
		entry.kind,
		entry.endpointMode,
	]),
) as Record<ProviderKind, ProviderEndpointMode>;

export const getProviderEndpointMode = (kind: ProviderKind) =>
	endpointModes[kind];

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
	{
		value: "tokens",
		label: "Tokens",
	},
	{
		value: "requests",
		label: "Requests",
	},
] as const;
