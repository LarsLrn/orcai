import { keepPreviousData, type skipToken } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc/orpc";
import { queryClient } from "@/router";
import type { OrpcInputs } from "../orpc/contracts";

export const organizationInvitationQueryOptions = {
	list: ({
		input,
	}: {
		input: OrpcInputs["organizationInvitation"]["list"] | typeof skipToken;
	}) => {
		return orpc.organizationInvitation.list.queryOptions({
			input,
			queryKey: orpc.organizationInvitation.list.key({
				input: typeof input === "symbol" ? undefined : input,
			}),
			placeholderData: keepPreviousData,
		});
	},

	find: ({
		input,
	}: {
		input: OrpcInputs["organizationInvitation"]["find"] | typeof skipToken;
	}) => {
		return orpc.organizationInvitation.find.queryOptions({
			input,
			queryKey: orpc.organizationInvitation.find.key({
				input: typeof input === "symbol" ? undefined : input,
			}),
			placeholderData: keepPreviousData,
		});
	},

	create: () => {
		return orpc.organizationInvitation.create.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.organizationInvitation.key(),
				});
			},
		});
	},

	update: () => {
		return orpc.organizationInvitation.update.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.organizationInvitation.key(),
				});
			},
		});
	},

	delete: () => {
		return orpc.organizationInvitation.delete.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.organizationInvitation.key(),
				});
			},
		});
	},

	respond: () => {
		return orpc.organizationInvitation.respond.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.organizationInvitation.key(),
				});
			},
		});
	},
} as const;
