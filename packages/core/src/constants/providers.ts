export const providerCompatibilities = [
	{
		value: "openai",
		label: "OpenAI (compatible)",
	},
	/* {
		value: "azure",
		label: "Azure OpenAI",
	},
	{
		value: "anthropic",
		label: "Anthropic",
	},
	{
		value: "google",
		label: "Google Gemini",
	}, */
] as const;

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
