import { keepPreviousData, type skipToken } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc/orpc";
import { queryClient } from "@/router";
import type { OrpcInputs } from "../orpc/contracts";

export const blockQueryOptions = {
	list: ({
		input,
	}: {
		input: OrpcInputs["block"]["list"] | typeof skipToken;
	}) => {
		return orpc.block.list.queryOptions({
			input,
			queryKey: orpc.block.list.key({
				input: typeof input === "symbol" ? undefined : input,
			}),
			placeholderData: keepPreviousData,
		});
	},

	find: ({
		input,
	}: {
		input: OrpcInputs["block"]["find"] | typeof skipToken;
	}) => {
		return orpc.block.find.queryOptions({
			input,
			queryKey: orpc.block.find.key({
				input: typeof input === "symbol" ? undefined : input,
			}),
			placeholderData: keepPreviousData,
		});
	},

	create: () => {
		return orpc.block.create.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.block.key(),
				});
			},
		});
	},

	update: () => {
		return orpc.block.update.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.block.key(),
				});
			},
		});
	},

	delete: () => {
		return orpc.block.delete.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.block.key(),
				});
			},
		});
	},
} as const;
