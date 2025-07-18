import { createOpenAI } from "@ai-sdk/openai";
import type { EmbeddingModel, LanguageModel } from "ai";
import { extractReasoningMiddleware, wrapLanguageModel } from "ai";

interface SaiaModel {
	id: string;
	demand: number;
	object: string;
	input: ("text" | "image" | "video")[];
	output: ("text" | "thought")[];
	owned_by: string;
	name: string;
	status: "ready";
	created: number;
}

interface SaiaEmbeddingModel {
	id: string;
	object: "embedding_model";
	input: ["text"];
	output: ["embedding"];
	owned_by: string;
	name: string;
	status: "ready";
	created: number;
}

export const saiaModels: SaiaModel[] = [
	{
		id: "meta-llama-3.1-8b-instruct",
		demand: 1,
		object: "model",
		input: ["text"],
		output: ["text"],
		owned_by: "chat-ai",
		name: "Meta Llama 3.1 8B Instruct",
		status: "ready",
		created: 1748003919,
	},
	{
		id: "gemma-3-27b-it",
		demand: 0,
		object: "model",
		input: ["text", "image"],
		output: ["text"],
		owned_by: "chat-ai",
		name: "Gemma 3 27B Instruct",
		status: "ready",
		created: 1748003919,
	},
	{
		id: "qwen3-32b",
		demand: 0,
		object: "model",
		input: ["text"],
		output: ["text", "thought"],
		owned_by: "chat-ai",
		name: "Qwen 3 32B",
		status: "ready",
		created: 1748003919,
	},
	{
		id: "qwen3-235b-a22b",
		demand: 0,
		object: "model",
		input: ["text"],
		output: ["text", "thought"],
		owned_by: "chat-ai",
		name: "Qwen 3 235B A22B",
		status: "ready",
		created: 1748003919,
	},
	{
		id: "llama-3.3-70b-instruct",
		demand: 1,
		object: "model",
		input: ["text"],
		output: ["text"],
		owned_by: "chat-ai",
		name: "Meta Llama 3.3 70B Instruct",
		status: "ready",
		created: 1748003919,
	},
	{
		id: "qwen2.5-vl-72b-instruct",
		demand: 0,
		object: "model",
		input: ["text", "image", "video"],
		output: ["text"],
		owned_by: "chat-ai",
		name: "Qwen 2.5 VL 72B Instruct",
		status: "ready",
		created: 1748003919,
	},
	{
		id: "qwq-32b",
		demand: 0,
		object: "model",
		input: ["text"],
		output: ["text", "thought"],
		owned_by: "chat-ai",
		name: "Qwen QwQ 32B",
		status: "ready",
		created: 1748003919,
	},
	{
		id: "deepseek-r1",
		demand: 7,
		object: "model",
		input: ["text"],
		output: ["text", "thought"],
		owned_by: "chat-ai",
		name: "DeepSeek R1",
		status: "ready",
		created: 1748003919,
	},
	{
		id: "deepseek-r1-distill-llama-70b",
		demand: 2,
		object: "model",
		input: ["text"],
		output: ["text", "thought"],
		owned_by: "chat-ai",
		name: "DeepSeek R1 Distill Llama 70B",
		status: "ready",
		created: 1748003919,
	},
	{
		id: "mistral-large-instruct",
		demand: 0,
		object: "model",
		input: ["text"],
		output: ["text"],
		owned_by: "chat-ai",
		name: "Mistral Large Instruct",
		status: "ready",
		created: 1748003919,
	},
	{
		id: "qwen2.5-coder-32b-instruct",
		demand: 0,
		object: "model",
		input: ["text"],
		output: ["text"],
		owned_by: "chat-ai",
		name: "Qwen 2.5 Coder 32B Instruct",
		status: "ready",
		created: 1748003919,
	},
	{
		id: "internvl2.5-8b",
		demand: 0,
		object: "model",
		input: ["text", "image"],
		output: ["text"],
		owned_by: "chat-ai",
		name: "InternVL2.5 8B MPO",
		status: "ready",
		created: 1748003919,
	},
	{
		id: "codestral-22b",
		demand: 0,
		object: "model",
		input: ["text"],
		output: ["text"],
		owned_by: "chat-ai",
		name: "Codestral 22B",
		status: "ready",
		created: 1748003919,
	},
	{
		id: "llama-3.1-sauerkrautlm-70b-instruct",
		demand: 0,
		object: "model",
		input: ["text"],
		output: ["text"],
		owned_by: "chat-ai",
		name: "Llama 3.1 SauerkrautLM 70B Instruct",
		status: "ready",
		created: 1748003919,
	},
] as const;

export const e5Mistral7bInstruct: SaiaEmbeddingModel = {
	id: "e5-mistral-7b-instruct",
	object: "embedding_model",
	input: ["text"],
	output: ["embedding"],
	owned_by: "chat-ai",
	name: "E5 Mistral 7B Instruct",
	status: "ready",
	created: 1748003919,
};

const saiaEmbeddingModelIds = [e5Mistral7bInstruct.id] as const;
type SaiaEmbeddingModelIdsType = "e5-mistral-7b-instruct";

type InputCapability = "text" | "image" | "video";

const textOnlyModelIds = [
	"meta-llama-3.1-8b-instruct",
	"qwen3-32b",
	"qwen3-235b-a22b",
	"llama-3.3-70b-instruct",
	"qwq-32b",
	"deepseek-r1",
	"deepseek-r1-distill-llama-70b",
	"mistral-large-instruct",
	"qwen2.5-coder-32b-instruct",
	"codestral-22b",
	"llama-3.1-sauerkrautlm-70b-instruct",
] as const;

const textImageModelIds = ["gemma-3-27b-it", "internvl2.5-8b"] as const;
const multimodalModelIds = ["qwen2.5-vl-72b-instruct"] as const;

type TextOnlyModelIds = (typeof textOnlyModelIds)[number];
type TextImageModelIds = (typeof textImageModelIds)[number];
type MultimodalModelIds = (typeof multimodalModelIds)[number];

type ModelsWithText = TextOnlyModelIds | TextImageModelIds | MultimodalModelIds;
type ModelsWithImage = TextImageModelIds | MultimodalModelIds;
type ModelsWithVideo = MultimodalModelIds;

const chatAiProviderFactory = createOpenAI({
	baseURL: process.env.OPENAI_COMPATIBLE_BASE_URL,
	apiKey: process.env.OPENAI_COMPATIBLE_API_KEY,
	name: "chatAi",
});

function getSaiaModel(params: { input: ["text"]; model: ModelsWithText }): {
	provider: LanguageModel;
	meta: SaiaModel;
};
function getSaiaModel(params: { input: ["image"]; model: ModelsWithImage }): {
	provider: LanguageModel;
	meta: SaiaModel;
};
function getSaiaModel(params: { input: ["video"]; model: ModelsWithVideo }): {
	provider: LanguageModel;
	meta: SaiaModel;
};
function getSaiaModel(params: {
	input: ["text", "image"];
	model: ModelsWithImage;
}): { provider: LanguageModel; meta: SaiaModel };
function getSaiaModel(params: {
	input: ["text", "video"];
	model: ModelsWithVideo;
}): { provider: LanguageModel; meta: SaiaModel };
function getSaiaModel(params: {
	input: ["image", "video"];
	model: ModelsWithVideo;
}): { provider: LanguageModel; meta: SaiaModel };
function getSaiaModel(params: {
	input: ["text", "image", "video"];
	model: MultimodalModelIds;
}): { provider: LanguageModel; meta: SaiaModel };
function getSaiaModel(params: { input: InputCapability[]; model: string }): {
	provider: LanguageModel;
	meta: SaiaModel;
};
function getSaiaModel(params: { input: InputCapability[]; model: string }): {
	provider: LanguageModel;
	meta: SaiaModel;
} {
	const foundModel = saiaModels.find((m) => m.id === params.model);
	if (!foundModel) {
		throw new Error(`Language model with id "${params.model}" not found.`);
	}
	const supportsAllInputs = params.input.every((requiredInput) =>
		foundModel.input.includes(requiredInput),
	);
	if (!supportsAllInputs) {
		throw new Error(
			`Model "${params.model}" does not support all required inputs: ${params.input.join(
				", ",
			)}. Supported: ${foundModel.input.join(", ")}`,
		);
	}
	const modelProvider = chatAiProviderFactory.chat(foundModel.id);
	if (foundModel.output.includes("thought")) {
		return {
			provider: wrapLanguageModel({
				model: modelProvider,
				middleware: extractReasoningMiddleware({ tagName: "think" }),
			}),
			meta: foundModel,
		};
	}
	return { provider: modelProvider, meta: foundModel };
}

export function getSaiaEmbeddingModel(params: {
	model: SaiaEmbeddingModelIdsType;
}): { provider: EmbeddingModel<string>; meta: SaiaEmbeddingModel } {
	if (params.model === e5Mistral7bInstruct.id) {
		const embeddingProvider = chatAiProviderFactory.embedding(params.model);
		return { provider: embeddingProvider, meta: e5Mistral7bInstruct };
	}
	throw new Error(`Embedding model with id "${params.model}" not found.`);
}

export {
	getSaiaModel,
	textOnlyModelIds,
	textImageModelIds,
	multimodalModelIds,
	saiaEmbeddingModelIds,
};

export type {
	InputCapability,
	TextOnlyModelIds,
	TextImageModelIds,
	MultimodalModelIds,
	ModelsWithText,
	ModelsWithImage,
	ModelsWithVideo,
	SaiaEmbeddingModel,
	SaiaEmbeddingModelIdsType as SaiaEmbeddingModelIds,
};
