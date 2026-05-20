import { type ChatConfig, chatConfigSchema } from "@orcai/schema";
import { formOptions } from "@tanstack/react-form";
import type { z } from "zod/v4";
import { resolveChatGenerationParams } from "@/lib/ai/utils/chat-generation-defaults";

const defaultValues = (
	config: ChatConfig,
): z.input<typeof chatConfigSchema> => {
	const generationParams = resolveChatGenerationParams(config);

	return {
		modelId: config.modelId,
		providerId: config.providerId,
		systemPrompt: config.systemPrompt ?? "",
		...generationParams,
	};
};

export const chatConfigFormOptions = (config: ChatConfig) =>
	formOptions({
		defaultValues: defaultValues(config),
		validators: {
			onChange: chatConfigSchema,
		},
	});
