import type { Capability, Compatibility } from "../../src/db/schema/model";

// Define the providers first with a const assertion to create literal types
const PROVIDERS = [
	{
		slug: "github_models",
		name: "GitHub Models",
		description: "Various AI models available on GitHub for different tasks",
		website: "https://github.com",
		compatibility: "openai",
		endpoint: "https://models.github.ai/inference",
	},
	{
		slug: "saia",
		name: "SAIA (GWDG)",
		description: "Open source AI models provided by GWDG",
		website: "https://gwdg.de/",
		compatibility: "openai",
		endpoint: "https://chat-ai.academiccloud.de/v1",
	},
	{
		slug: "google",
		name: "Google",
		description: "Gemini and other Google AI models",
		website: "https://ai.google.dev",
		compatibility: "google",
		endpoint: undefined,
	},
] as const satisfies readonly SeedProvider[];

// Extract provider slugs as a union type
type ProviderSlug = (typeof PROVIDERS)[number]["slug"];

// Define capabilities with const assertion
const CAPABILITIES = [
	{
		capability: "text-generation",
		name: "Text Generation",
		description: "Generate human-like text for various purposes",
	},
	{
		capability: "image-generation",
		name: "Image Generation",
		description: "Create images from text descriptions",
	},
	{
		capability: "embedding",
		name: "Text Embeddings",
		description: "Convert text into numerical vectors for similarity search",
	},
	{
		capability: "tool-calling",
		name: "Tool Calling",
		description: "Invoke external tools or APIs from within the model",
	},
	{
		capability: "reasoning",
		name: "Reasoning",
		description: "Perform complex reasoning tasks and answer questions",
	},
] as const satisfies readonly SeedCapability[];

// Base interfaces
export interface SeedProvider {
	slug: string;
	name: string;
	description: string;
	website: string;
	compatibility: Compatibility;
	endpoint?: string;
}

export interface SeedCapability {
	capability: Capability;
	name: string;
	description: string;
}

// Type-safe model interface that only allows existing provider slugs
export interface SeedModel<TProviderSlug extends ProviderSlug = ProviderSlug> {
	slug: string;
	providerSlug: TProviderSlug;
	name: string;
	description: string;
	capabilities: readonly Capability[];
	isDeprecated?: boolean;
}

// Helper function to create type-safe models
export function createModel<TProviderSlug extends ProviderSlug>(
	model: SeedModel<TProviderSlug>,
): SeedModel<TProviderSlug> {
	return model;
}

// Type-safe models array - TypeScript will enforce that providerSlug exists in PROVIDERS
const MODELS = [
	createModel({
		slug: "openai/gpt-4.1-mini",
		providerSlug: "github_models", // ✅ Type-safe: must be one of the provider slugs
		name: "GPT-4o mini",
		description:
			"Latest multimodal flagship model, cheaper and faster than GPT-4 Turbo",
		capabilities: ["text-generation"] as const,
	}),
	createModel({
		slug: "gemini-2.0-flash",
		providerSlug: "google", // ✅ Type-safe: must be one of the provider slugs
		name: "Gemini 2.0 Flash",
		description: "Google's free and fast model for text generation",
		capabilities: ["text-generation"] as const,
	}),

	// SAIA (GWDG) Models - Text Generation
	createModel({
		slug: "meta-llama-3.1-8b-instruct",
		providerSlug: "saia",
		name: "Meta Llama 3.1 8B Instruct",
		description: "Efficient instruction-following model from Meta",
		capabilities: ["text-generation"] as const,
	}),
	createModel({
		slug: "llama-3.3-70b-instruct",
		providerSlug: "saia",
		name: "Meta Llama 3.3 70B Instruct",
		description:
			"Large instruction-following model from Meta with improved capabilities",
		capabilities: ["text-generation"] as const,
	}),
	createModel({
		slug: "mistral-large-instruct",
		providerSlug: "saia",
		name: "Mistral Large Instruct",
		description: "High-performance instruction-following model from Mistral AI",
		capabilities: ["text-generation"] as const,
	}),
	createModel({
		slug: "qwen2.5-coder-32b-instruct",
		providerSlug: "saia",
		name: "Qwen 2.5 Coder 32B Instruct",
		description: "Specialized coding model from Alibaba Cloud",
		capabilities: ["text-generation"] as const,
	}),
	createModel({
		slug: "codestral-22b",
		providerSlug: "saia",
		name: "Codestral 22B",
		description: "Code generation model from Mistral AI",
		capabilities: ["text-generation"] as const,
	}),
	createModel({
		slug: "llama-3.1-sauerkrautlm-70b-instruct",
		providerSlug: "saia",
		name: "Llama 3.1 SauerkrautLM 70B Instruct",
		description:
			"German-optimized instruction-following model based on Llama 3.1",
		capabilities: ["text-generation"] as const,
	}),

	// SAIA Models with Reasoning (thought output)
	createModel({
		slug: "qwen3-32b",
		providerSlug: "saia",
		name: "Qwen 3 32B",
		description:
			"Advanced reasoning model from Alibaba Cloud with thought capabilities",
		capabilities: ["text-generation", "reasoning"] as const,
	}),
	createModel({
		slug: "qwen3-235b-a22b",
		providerSlug: "saia",
		name: "Qwen 3 235B A22B",
		description: "Large-scale reasoning model with advanced thought processes",
		capabilities: ["text-generation", "reasoning"] as const,
	}),
	createModel({
		slug: "qwq-32b",
		providerSlug: "saia",
		name: "Qwen QwQ 32B",
		description: "Question-answering focused model with reasoning capabilities",
		capabilities: ["text-generation", "reasoning"] as const,
	}),
	createModel({
		slug: "deepseek-r1",
		providerSlug: "saia",
		name: "DeepSeek R1",
		description:
			"Advanced reasoning model with sophisticated thought processes",
		capabilities: ["text-generation", "reasoning"] as const,
	}),
	createModel({
		slug: "deepseek-r1-distill-llama-70b",
		providerSlug: "saia",
		name: "DeepSeek R1 Distill Llama 70B",
		description: "Distilled version of DeepSeek R1 with reasoning capabilities",
		capabilities: ["text-generation", "reasoning"] as const,
	}),

	// SAIA Multimodal Models (text + image)
	createModel({
		slug: "gemma-3-27b-it",
		providerSlug: "saia",
		name: "Gemma 3 27B Instruct",
		description:
			"Multimodal instruction-following model supporting text and images",
		capabilities: ["text-generation"] as const,
	}),
	createModel({
		slug: "internvl2.5-8b",
		providerSlug: "saia",
		name: "InternVL2.5 8B MPO",
		description: "Vision-language model for text and image understanding",
		capabilities: ["text-generation"] as const,
	}),

	// SAIA Advanced Multimodal Model (text + image + video)
	createModel({
		slug: "qwen2.5-vl-72b-instruct",
		providerSlug: "saia",
		name: "Qwen 2.5 VL 72B Instruct",
		description:
			"Advanced vision-language model supporting text, images, and video",
		capabilities: ["text-generation"] as const,
	}),

	// SAIA Embedding Model
	createModel({
		slug: "e5-mistral-7b-instruct",
		providerSlug: "saia",
		name: "E5 Mistral 7B Instruct",
		description: "High-quality text embedding model based on Mistral",
		capabilities: ["embedding"] as const,
	}),
] as const satisfies readonly SeedModel[];

// Validation function to ensure data integrity at runtime
export function validateSeedData() {
	const providerSlugs = new Set(PROVIDERS.map((p) => p.slug));
	const invalidModels = MODELS.filter(
		(model) => !providerSlugs.has(model.providerSlug),
	);

	if (invalidModels.length > 0) {
		throw new Error(
			`Invalid provider slugs found in models: ${invalidModels
				.map((m) => `${m.slug} -> ${m.providerSlug}`)
				.join(", ")}`,
		);
	}

	console.log("✅ Seed data validation passed");
}

// Export the seed data with type safety
export const seedData = {
	providers: PROVIDERS,
	capabilities: CAPABILITIES,
	models: MODELS,
} as const;

// Export types for external use
export type { ProviderSlug };
