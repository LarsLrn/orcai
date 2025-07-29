import { keepPreviousData, type skipToken } from "@tanstack/react-query";
import type { OrpcInputs } from "@/lib/orpc/contracts";
import { orpc } from "@/lib/orpc/orpc";

export const assetPointQueryOptions = {
	list: ({
		input,
	}: {
		input: OrpcInputs["assetPoints"]["list"] | typeof skipToken;
	}) => {
		return orpc.assetPoints.list.queryOptions({
			input,
			queryKey: orpc.assetPoints.list.key({
				input: typeof input === "symbol" ? undefined : input,
			}),
			placeholderData: keepPreviousData,
		});
	},
} as const;
