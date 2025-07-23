import { keepPreviousData, type skipToken } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc/orpc";
import { queryClient } from "@/router";
import type { OrpcInputs } from "../orpc/contracts";

export const organizationQueryOptions = {
	list: ({
		input,
	}: {
		input: OrpcInputs["organization"]["list"] | typeof skipToken;
	}) => {
		return orpc.organization.list.queryOptions({
			input,
			queryKey: orpc.organization.list.key({
				input: typeof input === "symbol" ? undefined : input,
			}),
			placeholderData: keepPreviousData,
		});
	},

	find: ({
		input,
	}: {
		input: OrpcInputs["organization"]["find"] | typeof skipToken;
	}) => {
		return orpc.organization.find.queryOptions({
			input,
			queryKey: orpc.organization.find.key({
				input: typeof input === "symbol" ? undefined : input,
			}),
			placeholderData: keepPreviousData,
		});
	},

	create: () => {
		return orpc.organization.create.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.organization.key(),
				});
			},
		});
	},

	update: () => {
		return orpc.organization.update.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.organization.key(),
				});
			},
		});
	},

	delete: () => {
		return orpc.organization.delete.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.organization.key(),
				});
			},
		});
	},
} as const;
