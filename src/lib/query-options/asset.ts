import {
	keepPreviousData,
	type QueryClient,
	type skipToken,
} from "@tanstack/react-query";
import { orpc } from "@/lib/orpc/orpc";
import type { OrpcInputs } from "../orpc/contracts";

export const assetQueryOptions = {
	list: ({
		input,
	}: {
		input: OrpcInputs["asset"]["list"] | typeof skipToken;
	}) => {
		return orpc.asset.list.queryOptions({
			input,
			queryKey: orpc.asset.list.key({
				input: typeof input === "symbol" ? undefined : input,
			}),
			placeholderData: keepPreviousData,
		});
	},

	find: ({
		input,
	}: {
		input: OrpcInputs["asset"]["find"] | typeof skipToken;
	}) => {
		return orpc.asset.find.queryOptions({
			input,
			queryKey: orpc.asset.find.key({
				input: typeof input === "symbol" ? undefined : input,
			}),
			placeholderData: keepPreviousData,
		});
	},

	create: (queryClient: QueryClient) => {
		return orpc.asset.create.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.asset.key(),
				});
			},
		});
	},

	update: (queryClient: QueryClient) => {
		return orpc.asset.update.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.asset.key(),
				});
			},
		});
	},

	delete: (queryClient: QueryClient) => {
		return orpc.asset.delete.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.asset.key(),
				});
			},
		});
	},
} as const;
