import { z } from "zod/v4";

const proseFields = z.registry<{
	description: string;
}>();

/** A display field the model writes in Markdown, with citations when its turn can cite. */
export const proseField = (description: string) =>
	z.string().register(proseFields, {
		description,
	});

/** The description of a prose field's schema for a turn; undefined for any other schema. */
export const proseDescription = (
	schema: z.core.$ZodType,
	{
		citations,
	}: {
		citations: boolean;
	},
) => {
	const field = proseFields.get(schema);

	return (
		field &&
		`${field.description} ${citations ? "Markdown and citations allowed." : "Markdown allowed."}`
	);
};
