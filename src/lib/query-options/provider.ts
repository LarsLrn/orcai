import { keepPreviousData, type skipToken } from "@tanstack/react-query";
import type { OrpcInputs } from "@/lib/orpc/contracts";
import { orpc } from "@/lib/orpc/orpc";

export const providerQueryOptions = {
	list: () => {
		return orpc.provider.list.queryOptions({
			queryKey: orpc.provider.list.key(),
			placeholderData: keepPreviousData,
		});
	},

	find: ({
		input,
	}: {
		input: OrpcInputs["provider"]["find"] | typeof skipToken;
	}) => {
		return orpc.provider.find.queryOptions({
			input,
			queryKey: orpc.provider.find.key({
				input: typeof input === "symbol" ? undefined : input,
			}),
			placeholderData: keepPreviousData,
		});
	},
} as const;
