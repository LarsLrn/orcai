import type { QueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc/orpc";

export const taskQueryOptions = {
	createAssetTask: (queryClient: QueryClient) => {
		return orpc.task.createAssetTask.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.task.key(),
				});
			},
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
