import {
	keepPreviousData,
	type QueryClient,
	type skipToken,
} from "@tanstack/react-query";
import type { OrpcInputs } from "@/lib/orpc/contracts";
import { orpc } from "@/lib/orpc/orpc";

export const botQueryOptions = {
	list: ({
		input,
	}: {
		input: OrpcInputs["bot"]["list"] | typeof skipToken;
	}) => {
		return orpc.bot.list.queryOptions({
			input,
			queryKey: orpc.bot.list.key({
				input: typeof input === "symbol" ? undefined : input,
			}),
			placeholderData: keepPreviousData,
		});
	},

	find: ({
		input,
	}: {
		input: OrpcInputs["bot"]["find"] | typeof skipToken;
	}) => {
		return orpc.bot.find.queryOptions({
			input,
			queryKey: orpc.bot.find.key({
				input: typeof input === "symbol" ? undefined : input,
			}),
			placeholderData: keepPreviousData,
		});
	},

	create: (queryClient: QueryClient) => {
		return orpc.bot.create.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.bot.key(),
				});
			},
		});
	},

	update: (queryClient: QueryClient) => {
		return orpc.bot.update.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.bot.key(),
				});
			},
		});
	},

	delete: (queryClient: QueryClient) => {
		return orpc.bot.delete.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.bot.key(),
				});
			},
		});
	},
} as const;
