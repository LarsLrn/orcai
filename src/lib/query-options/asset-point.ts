import { keepPreviousData, type skipToken } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc/orpc";
import type { OrpcInputs } from "../orpc/contracts";

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
