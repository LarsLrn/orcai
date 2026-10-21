import { type JSONSchema7, jsonSchema, type Schema } from "ai";
import { z } from "zod/v4";

/**
 * A tool's input schema as every step sends it: the JSON schema without
 * `$schema` and without the pattern of a UUID, whose `format` says the same.
 * Zod still validates the input.
 */
export const toolInputSchema = <Input>(
	schema: z.ZodType<Input>,
): Schema<Input> =>
	jsonSchema<Input>(
		() => {
			const { $schema: _, ...json } = z.toJSONSchema(schema, {
				target: "draft-7",
				io: "input",
				reused: "inline",
				override: ({ jsonSchema: node }) => {
					if (node.format === "uuid") {
						node.pattern = undefined;
					}
					// Providers such as OpenAI reject open objects.
					if (
						node.type === "object" &&
						node.additionalProperties === undefined
					) {
						node.additionalProperties = false;
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
