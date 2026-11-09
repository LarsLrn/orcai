import { type ChatConfig, chatConfigSchema } from "@orcai/schema";
import { formOptions } from "@tanstack/react-form";
import type { z } from "zod/v4";

const defaultValues = (
	config: ChatConfig,
): z.input<typeof chatConfigSchema> => ({
	modelId: config.modelId,
	providerId: config.providerId,
	systemPrompt: config.systemPrompt ?? "",
	temperature: config.temperature,
	maxTokens: config.maxTokens,
	topP: config.topP,
	frequencyPenalty: config.frequencyPenalty,
	presencePenalty: config.presencePenalty,
});

export const chatConfigFormOptions = (config: ChatConfig) =>
	formOptions({
		defaultValues: defaultValues(config),
		validators: {
			onChange: chatConfigSchema,
		},
	});
