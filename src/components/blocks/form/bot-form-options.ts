import { formOptions } from "@tanstack/form-core";
import type { Block } from "@/lib/orpc/schemas/block";
import { type Bot, botInsertSchema } from "@/lib/orpc/schemas/bot";

const defaultValues = (bot?: Bot, blockIds?: Block["id"][]) => ({
	name: bot?.name ?? "",
	description: bot?.description ?? "",
	contentJson: bot?.contentJson ?? ({} as any), // FIXME: Avoid using 'any'
	contentHtml: bot?.contentHtml ?? "",
	blockIds: blockIds ?? [],
});

export const botFormOptions = (bot?: Bot, blockIds?: Block["id"][]) =>
	formOptions({
		defaultValues: defaultValues(bot, blockIds),
		validators: {
			onChange: botInsertSchema,
		},
	});
