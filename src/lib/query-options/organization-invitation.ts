import {
	keepPreviousData,
	type QueryClient,
	type skipToken,
} from "@tanstack/react-query";
import { orpc } from "@/lib/orpc/orpc";
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

	create: (queryClient: QueryClient) => {
		return orpc.organizationInvitation.create.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.organizationInvitation.key(),
				});
			},
		});
	},

	update: (queryClient: QueryClient) => {
		return orpc.organizationInvitation.update.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.organizationInvitation.key(),
				});
			},
		});
	},

	delete: (queryClient: QueryClient) => {
		return orpc.organizationInvitation.delete.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.organizationInvitation.key(),
				});
			},
		});
	},

	respond: (queryClient: QueryClient) => {
		return orpc.organizationInvitation.respond.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.organizationInvitation.key(),
				});
			},
		});
	},
} as const;
