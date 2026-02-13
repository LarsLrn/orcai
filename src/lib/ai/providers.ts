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
		value: "video",
		label: "Video",
	},
	{
		value: "audio",
		label: "Audio",
	},
	{
		value: "reasoning",
		label: "Reasoning",
	},
] as const;
