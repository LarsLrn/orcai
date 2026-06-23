export const providerCompatibilities = [
	{
		value: "openai",
		label: "OpenAI",
	},
	{
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
	},
] as const;

export const modelCapabilities = [
	{
		value: "text",
		label: "Text",
	},
	{
		value: "embedding",
		label: "Embedding",
	},
	{
		value: "image",
		label: "Image",
	},
	{
		value: "image-generation",
		label: "Image Generation",
	},
	{
		value: "video",
		label: "Video",
	},
	{
		value: "audio",
		label: "Audio",
	},
	{
		value: "audio-generation",
		label: "Audio Generation",
	},
	{
		value: "reasoning",
		label: "Reasoning",
	},
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
