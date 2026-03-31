import { formOptions } from "@tanstack/react-form";
import type { z } from "zod/v4";
import { type Model, modelInsertSchema } from "@/lib/orpc/schemas/model";

const defaultValues = (model?: Model): z.input<typeof modelInsertSchema> => ({
	providerId: model?.providerId ?? "",
	providerModelId: model?.providerModelId ?? "",
	capabilities: model?.capabilities ?? [],
	name: model?.name ?? "",
	description: model?.description ?? "",
	isDeprecated: model?.isDeprecated ?? false,
});

export const modelFormOptions = (model?: Model) =>
	formOptions({
		defaultValues: defaultValues(model),
		validators: {
			onChange: modelInsertSchema,
		},
	});
