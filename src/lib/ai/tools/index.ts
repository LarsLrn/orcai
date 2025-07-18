import type { InferUITools, UIMessage } from "ai";
import z from "zod/v4";
import type { generateImageTool } from "./generate-image";
import type { generateJokeTool } from "./generate-joke";

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
};

type CustomTools = InferUITools<ToolsType>;

export type CustomUIMessage = UIMessage<
	CustomMetadata,
	CustomDataPart,
	CustomTools
>;
