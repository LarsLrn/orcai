import { z } from "zod/v4";

export const createUniqueRefsInputSchema = <
	TKey extends string,
	TValueSchema extends z.ZodType,
>({
	key,
	value,
	entityName,
	max = 500,
}: {
	key: TKey;
	value: TValueSchema;
	entityName: string;
	max?: number;
}) =>
	z
		.array(
			z.object({
				[key]: value,
			} as Record<TKey, TValueSchema>),
		)
		.min(1, `Please select at least one ${entityName}`)
		.max(max, `Please select no more than ${max} ${entityName}`)
		.check((ctx) => {
			const refs = ctx.value as Array<Record<TKey, unknown>>;
			const ids = refs.map((ref) => ref[key]);
			const uniqueCount = new Set(ids).size;

			if (uniqueCount !== ids.length) {
				ctx.issues.push({
					code: "custom",
					message: "Selected items must be unique",
					path: [
						"refs",
					],
					input: "",
				});
			}
		});
