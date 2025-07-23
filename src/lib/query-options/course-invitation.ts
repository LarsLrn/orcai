import { keepPreviousData, type skipToken } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc/orpc";
import { queryClient } from "@/router";
import type { OrpcInputs } from "../orpc/contracts";

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

	create: () => {
		return orpc.courseInvitation.create.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.courseInvitation.key(),
				});
			},
		});
	},

	update: () => {
		return orpc.courseInvitation.update.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.courseInvitation.key(),
				});
			},
		});
	},

	delete: () => {
		return orpc.courseInvitation.delete.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.courseInvitation.key(),
				});
			},
		});
	},

	respond: () => {
		return orpc.courseInvitation.respond.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.courseInvitation.key(),
				});
			},
		});
	},
} as const;
