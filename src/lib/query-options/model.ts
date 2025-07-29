import { keepPreviousData, type skipToken } from "@tanstack/react-query";
import type { OrpcInputs } from "@/lib/orpc/contracts";
import { orpc } from "@/lib/orpc/orpc";

export const modelQueryOptions = {
	list: ({
		input,
	}: {
		input: OrpcInputs["model"]["list"] | typeof skipToken;
	}) => {
		return orpc.model.list.queryOptions({
			input,
			queryKey: orpc.model.list.key({
				input: typeof input === "symbol" ? undefined : input,
			}),
			placeholderData: keepPreviousData,
		});
	},

	find: ({
		input,
	}: {
		input: OrpcInputs["model"]["find"] | typeof skipToken;
	}) => {
		return orpc.model.find.queryOptions({
			input,
			queryKey: orpc.model.find.key({
				input: typeof input === "symbol" ? undefined : input,
			}),
			placeholderData: keepPreviousData,
		});
	},
} as const;
