import {
	createImageGenerationBlockInputSchema,
	type ImageGenerationBlock,
} from "@orcai/schema";
import { formOptions } from "@tanstack/react-form";
import type { z } from "zod/v4";

const defaultValues = (
	block?: ImageGenerationBlock,
): z.input<typeof createImageGenerationBlockInputSchema> => ({
	name: block?.name || "",
	description: block?.description ?? null,
	contentJson: block?.contentJson ?? null,
	contentHtml: block?.contentHtml ?? null,
	type: "imageGeneration",
	status: block?.status || "draft",
	config: {
		prompt: block?.config.prompt ?? "",
		model: block?.config.model ?? "",
		provider: block?.config.provider ?? "",
	},
});

export const imageGenerationBlockFormOptions = (block?: ImageGenerationBlock) =>
	formOptions({
		defaultValues: defaultValues(block),
		validators: {
			onChange: createImageGenerationBlockInputSchema,
		},
	});
