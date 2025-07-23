import { keepPreviousData, type skipToken } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc/orpc";
import { queryClient } from "@/router";
import type { OrpcInputs } from "../orpc/contracts";

export const chatMessageQueryOptions = {
	list: ({
		input,
	}: {
		input: OrpcInputs["chatMessage"]["list"] | typeof skipToken;
	}) => {
		return orpc.chatMessage.list.queryOptions({
			input,
			queryKey: orpc.chatMessage.list.key({
				input: typeof input === "symbol" ? undefined : input,
			}),
			placeholderData: keepPreviousData,
		});
	},

	find: ({
		input,
	}: {
		input: OrpcInputs["chatMessage"]["find"] | typeof skipToken;
	}) => {
		return orpc.chatMessage.find.queryOptions({
			input,
			queryKey: orpc.chatMessage.find.key({
				input: typeof input === "symbol" ? undefined : input,
			}),
			placeholderData: keepPreviousData,
		});
	},

	create: () => {
		return orpc.chatMessage.create.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.chatMessage.key(),
				});
			},
		});
	},

	update: () => {
		return orpc.chatMessage.update.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.chatMessage.key(),
				});
			},
		});
	},

	delete: () => {
		return orpc.chatMessage.delete.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.chatMessage.key(),
				});
			},
		});
	},

	rate: () => {
		return orpc.chatMessage.rate.mutationOptions({
			onSuccess: (result) => {
				queryClient.invalidateQueries({
					queryKey: orpc.chatMessage.key({
						input: { chatId: result.data.chatId },
					}),
				});
			},
		});
	},
} as const;
