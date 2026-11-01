import { type JSONSchema7, jsonSchema, type Schema } from "ai";
import { z } from "zod/v4";

/**
 * A tool's input schema as every step sends it: the JSON schema without
 * `$schema` and without the pattern of a UUID, whose `format` says the same.
 * Zod still validates the input. Input objects are `z.strictObject`, which
 * providers such as OpenAI require and which names a key the model invents.
 */
export const toolInputSchema = <Input>(
	schema: z.ZodType<Input>,
	/** A description to give a schema node in place of its own. */
	describe?: (node: z.core.$ZodType) => string | undefined,
): Schema<Input> =>
	jsonSchema<Input>(
		() => {
			const { $schema: _, ...json } = z.toJSONSchema(schema, {
				target: "draft-7",
				io: "input",
				reused: "inline",
				override: ({ zodSchema, jsonSchema: node }) => {
					if (node.format === "uuid") {
						node.pattern = undefined;
					}
					const description = describe?.(zodSchema);
					if (description !== undefined) {
						node.description = description;
					}
				},
			});

			return json as JSONSchema7;
		},
		{
			validate: async (value) => {
				const result = await schema.safeParseAsync(value);

				return result.success
					? {
							success: true,
							value: result.data,
						}
					: {
							success: false,
							error: result.error,
						};
			},
		},
	);
