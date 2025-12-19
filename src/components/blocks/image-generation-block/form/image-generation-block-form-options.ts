import { formOptions } from "@tanstack/react-form";
import type { z } from "zod/v4";
import {
	type ImageGenerationBlock,
	imageGenerationBlockInsertSchema,
} from "@/lib/orpc/schemas/block";

const defaultValues = (
	block?: ImageGenerationBlock,
): z.input<typeof imageGenerationBlockInsertSchema> => ({
	name: block?.name || "",
	type: "imageGeneration",
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
			onChange: imageGenerationBlockInsertSchema,
		},
	});
