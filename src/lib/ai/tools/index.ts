import type { InferUITools, UIMessage, UIMessagePart } from "ai";
import z from "zod/v4";
import type { generateImageTool } from "./generate-image";
import type { generateJokeTool } from "./generate-joke";
import type { searchKnowledgeBaseTool } from "./search-knowledgebase";

const metadataSchema = z.object({
	someMetadata: z.string(),
});

type CustomMetadata = z.infer<typeof metadataSchema>;

const dataPartSchema = z.object({
	someDataPart: z.object({}),
	anotherDataPart: z.object({}),
});

type CustomDataPart = z.infer<typeof dataPartSchema>;

// Create a type-only version for inference
type ToolsType = {
	generateImage: ReturnType<typeof generateImageTool>;
	generateJoke: ReturnType<typeof generateJokeTool>;
	searchKnowledgeBase: ReturnType<typeof searchKnowledgeBaseTool>;
};

export type CustomTools = InferUITools<ToolsType>;

export type CustomUIMessage = UIMessage<
	CustomMetadata,
	CustomDataPart,
	CustomTools
>;

/**
 * -------------------
 * Specific Tool Parts
 * -------------------
 */

export type SearchKnowledgeBaseToolPart = Extract<
	UIMessagePart<CustomDataPart, CustomTools>,
	{ type: "tool-searchKnowledgeBase" }
>;

export type GenerateImageToolPart = Extract<
	UIMessagePart<CustomDataPart, CustomTools>,
	{ type: "tool-generateImage" }
>;
