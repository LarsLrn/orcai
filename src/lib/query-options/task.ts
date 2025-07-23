import { orpc } from "@/lib/orpc/orpc";
import { queryClient } from "@/router";

export const taskQueryOptions = {
	createAssetTask: () => {
		return orpc.task.createAssetTask.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.task.key(),
				});
			},
		});
	},
} as const;
