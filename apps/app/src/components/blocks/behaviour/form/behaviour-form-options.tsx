import { type Behaviour, createBehaviourInputSchema } from "@orcai/schema";
import { formOptions } from "@tanstack/react-form";
import { z } from "zod/v4";

const behaviourFormSchema = createBehaviourInputSchema.extend({
	description: z.string(),
});

const defaultValues = (
	block?: Behaviour,
): z.input<typeof behaviourFormSchema> => ({
	name: block?.name || "",
	description: block?.description ?? "",
	contentJson: block?.contentJson ?? null,
	type: "behaviour",
	status: block?.status || "draft",
	config: {
		systemPrompt: block?.config.systemPrompt ?? "",
	},
});

export const behaviourFormOptions = (block?: Behaviour) =>
	formOptions({
		defaultValues: defaultValues(block),
		validators: {
			onChange: behaviourFormSchema,
		},
	});
