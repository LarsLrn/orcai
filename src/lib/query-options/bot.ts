import { keepPreviousData, type skipToken } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc/orpc";
import { queryClient } from "@/router";
import type { OrpcInputs } from "../orpc/contracts";

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

	create: () => {
		return orpc.bot.create.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.bot.key(),
				});
			},
		});
	},

	update: () => {
		return orpc.bot.update.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.bot.key(),
				});
			},
		});
	},

	delete: () => {
		return orpc.bot.delete.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.bot.key(),
				});
			},
		});
	},
} as const;
