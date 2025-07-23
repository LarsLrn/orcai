import {
	keepPreviousData,
	type QueryClient,
	type skipToken,
} from "@tanstack/react-query";
import { orpc } from "@/lib/orpc/orpc";
import type { OrpcInputs, OrpcOutputs } from "../orpc/contracts";

export const chatQueryOptions = {
	list: ({
		input,
	}: {
		input: OrpcInputs["chat"]["list"] | typeof skipToken;
	}) => {
		return orpc.chat.list.queryOptions({
			input,
			queryKey: orpc.chat.list.key({
				input: typeof input === "symbol" ? undefined : input,
			}),
			placeholderData: keepPreviousData,
		});
	},

	find: ({
		input,
	}: {
		input: OrpcInputs["chat"]["find"] | typeof skipToken;
	}) => {
		return orpc.chat.find.queryOptions({
			input,
			queryKey: orpc.chat.find.key({
				input: typeof input === "symbol" ? undefined : input,
			}),
			placeholderData: keepPreviousData,
		});
	},

	create: (queryClient: QueryClient) => {
		return orpc.chat.create.mutationOptions({
			onSuccess: (result) => {
				// Cache needs to be updated directly as SpiceDB takes time to propagate changes
				// and the query will return stale data if we wait for the next refetch.
				queryClient.setQueryData(
					orpc.chat.list.key(),
					(oldData: OrpcOutputs["chat"]["list"] | undefined) => {
						if (!oldData) return { data: [result.data], rowCount: 1 };
						return {
							data: [result.data, ...oldData.data],
							rowCount: oldData.rowCount + 1,
						};
					},
				);

				queryClient.invalidateQueries({
					queryKey: orpc.chat.key(),
				});
			},
		});
	},

	update: (queryClient: QueryClient) => {
		return orpc.chat.update.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.chat.key(),
				});
			},
		});
	},

	delete: (queryClient: QueryClient) => {
		return orpc.chat.delete.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.chat.key(),
				});
			},
		});
	},
} as const;
