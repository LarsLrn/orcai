import {
	keepPreviousData,
	type QueryClient,
	type skipToken,
} from "@tanstack/react-query";
import { orpc } from "@/lib/orpc/orpc";
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

	create: (queryClient: QueryClient) => {
		return orpc.chatMessage.create.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.chatMessage.key(),
				});
			},
		});
	},

	update: (queryClient: QueryClient) => {
		return orpc.chatMessage.update.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.chatMessage.key(),
				});
			},
		});
	},

	delete: (queryClient: QueryClient) => {
		return orpc.chatMessage.delete.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.chatMessage.key(),
				});
			},
		});
	},

	rate: (queryClient: QueryClient) => {
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
