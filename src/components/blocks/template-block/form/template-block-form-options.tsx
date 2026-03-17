import { formOptions } from "@tanstack/react-form";
import type { z } from "zod/v4";
import {
	type TemplateBlock,
	templateBlockInsertSchema,
} from "@/lib/orpc/schemas/block";

const defaultValues = (
	block?: TemplateBlock,
): z.input<typeof templateBlockInsertSchema> => ({
	name: block?.name || "",
	description: block?.description ?? null,
	contentJson: block?.contentJson ?? null,
	contentHtml: block?.contentHtml ?? null,
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
			onChange: templateBlockInsertSchema,
		},
	});
