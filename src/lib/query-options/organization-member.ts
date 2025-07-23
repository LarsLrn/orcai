import { keepPreviousData, type skipToken } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc/orpc";
import { queryClient } from "@/router";
import type { OrpcInputs } from "../orpc/contracts";

export const organizationMemberQueryOptions = {
	list: ({
		input,
	}: {
		input: OrpcInputs["organizationMember"]["list"] | typeof skipToken;
	}) => {
		return orpc.organizationMember.list.queryOptions({
			input,
			queryKey: orpc.organizationMember.list.key({
				input: typeof input === "symbol" ? undefined : input,
			}),
			placeholderData: keepPreviousData,
		});
	},

	find: ({
		input,
	}: {
		input: OrpcInputs["organizationMember"]["find"] | typeof skipToken;
	}) => {
		return orpc.organizationMember.find.queryOptions({
			input,
			queryKey: orpc.organizationMember.find.key({
				input: typeof input === "symbol" ? undefined : input,
			}),
			placeholderData: keepPreviousData,
		});
	},

	create: () => {
		return orpc.organizationMember.create.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.organizationMember.key(),
				});
			},
		});
	},

	update: () => {
		return orpc.organizationMember.update.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.organizationMember.key(),
				});
			},
		});
	},

	delete: () => {
		return orpc.organizationMember.delete.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.organizationMember.key(),
				});
			},
		});
	},
} as const;
