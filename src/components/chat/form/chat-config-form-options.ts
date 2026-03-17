import { formOptions } from "@tanstack/react-form";
import type { z } from "zod/v4";
import { type ChatConfig, chatConfigSchema } from "@/lib/orpc/schemas/chat";

const defaultValues = (
	config: ChatConfig,
): z.input<typeof chatConfigSchema> => ({
	modelId: config.modelId,
	providerId: config.providerId,
	systemPrompt: config.systemPrompt ?? "",
	temperature: config.temperature ?? 1,
	maxTokens: config.maxTokens,
	topP: config.topP ?? 1,
	frequencyPenalty: config.frequencyPenalty ?? 0,
	presencePenalty: config.presencePenalty ?? 0,
});

export const chatConfigFormOptions = (config: ChatConfig) =>
	formOptions({
		defaultValues: defaultValues(config),
		validators: {
			onChange: chatConfigSchema,
		},
	});
