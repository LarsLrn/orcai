import { z } from "zod/v4";
import type { ErrorReason } from "./error-reason";

export const createUniqueRefsInputSchema = <
	TKey extends string,
	TValueSchema extends z.ZodType,
>({
	key,
	value,
	max = 500,
}: {
	key: TKey;
	value: TValueSchema;
	max?: number;
}) =>
	z
		.array(
			z.object({
				[key]: value,
			} as Record<TKey, TValueSchema>),
		)
		.min(1)
		.max(max)
		.check((ctx) => {
			const refs = ctx.value as Array<Record<TKey, unknown>>;
			const ids = refs.map((ref) => ref[key]);
			const uniqueCount = new Set(ids).size;

			if (uniqueCount !== ids.length) {
				ctx.issues.push({
					code: "custom",
					params: {
						reason: "ITEMS_NOT_UNIQUE" satisfies ErrorReason,
					},
					path: [
						"refs",
					],
					input: "",
				});
			}
		});
