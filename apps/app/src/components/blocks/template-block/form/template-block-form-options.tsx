import {
	createTemplateBlockInputSchema,
	type TemplateBlock,
} from "@orcai/schema";
import { formOptions } from "@tanstack/react-form";
import { z } from "zod/v4";

const templateBlockFormSchema = createTemplateBlockInputSchema.extend({
	description: z.string(),
	contentHtml: z.string(),
});

const defaultValues = (
	block?: TemplateBlock,
): z.input<typeof templateBlockFormSchema> => ({
	name: block?.name || "",
	description: block?.description ?? "",
	contentJson: block?.contentJson ?? null,
	contentHtml: block?.contentHtml ?? "",
	type: "template",
	status: block?.status || "draft",
	config: {
		systemPrompt: block?.config.systemPrompt ?? "",
	},
});

export const templateBlockFormOptions = (block?: TemplateBlock) =>
	formOptions({
		defaultValues: defaultValues(block),
		validators: {
			onChange: templateBlockFormSchema,
		},
	});
