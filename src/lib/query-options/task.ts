import {
	keepPreviousData,
	type QueryClient,
	type skipToken,
} from "@tanstack/react-query";
import type { OrpcInputs } from "@/lib/orpc/contracts";
import { orpc } from "@/lib/orpc/orpc";

export const taskQueryOptions = {
	list: ({
		input,
	}: {
		input: OrpcInputs["task"]["list"] | typeof skipToken;
	}) => {
		return orpc.task.list.queryOptions({
			input,
			queryKey: orpc.task.list.key({
				input: typeof input === "symbol" ? undefined : input,
			}),
			placeholderData: keepPreviousData,
		});
	},

	createDatabaseBlockVectorStore: (queryClient: QueryClient) => {
		return orpc.task.createDatabaseBlockVectorStore.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.task.key(),
				});
			},
		});
	},
} as const;
