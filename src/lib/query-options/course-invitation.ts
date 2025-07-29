import {
	keepPreviousData,
	type QueryClient,
	type skipToken,
} from "@tanstack/react-query";
import type { OrpcInputs } from "@/lib/orpc/contracts";
import { orpc } from "@/lib/orpc/orpc";

export const courseInvitationQueryOptions = {
	list: ({
		input,
	}: {
		input: OrpcInputs["courseInvitation"]["list"] | typeof skipToken;
	}) => {
		return orpc.courseInvitation.list.queryOptions({
			input,
			queryKey: orpc.courseInvitation.list.key({
				input: typeof input === "symbol" ? undefined : input,
			}),
			placeholderData: keepPreviousData,
		});
	},

	find: ({
		input,
	}: {
		input: OrpcInputs["courseInvitation"]["find"] | typeof skipToken;
	}) => {
		return orpc.courseInvitation.find.queryOptions({
			input,
			queryKey: orpc.courseInvitation.find.key({
				input: typeof input === "symbol" ? undefined : input,
			}),
			placeholderData: keepPreviousData,
		});
	},

	create: (queryClient: QueryClient) => {
		return orpc.courseInvitation.create.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.courseInvitation.key(),
				});
			},
		});
	},

	update: (queryClient: QueryClient) => {
		return orpc.courseInvitation.update.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.courseInvitation.key(),
				});
			},
		});
	},

	delete: (queryClient: QueryClient) => {
		return orpc.courseInvitation.delete.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.courseInvitation.key(),
				});
			},
		});
	},

	respond: (queryClient: QueryClient) => {
		return orpc.courseInvitation.respond.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.courseInvitation.key(),
				});
			},
		});
	},
} as const;
