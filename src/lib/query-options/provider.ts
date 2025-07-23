import { keepPreviousData, type skipToken } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc/orpc";
import type { OrpcInputs } from "../orpc/contracts";

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
