import { keepPreviousData, type skipToken } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc/orpc";
import { queryClient } from "@/router";
import type { OrpcInputs } from "../orpc/contracts";

export const organizationProviderQueryOptions = {
	list: ({
		input,
	}: {
		input: OrpcInputs["organizationProvider"]["list"] | typeof skipToken;
	}) => {
		return orpc.organizationProvider.list.queryOptions({
			input,
			queryKey: orpc.organizationProvider.list.key({
				input: typeof input === "symbol" ? undefined : input,
			}),
			placeholderData: keepPreviousData,
		});
	},

	find: ({
		input,
	}: {
		input: OrpcInputs["organizationProvider"]["find"] | typeof skipToken;
	}) => {
		return orpc.organizationProvider.find.queryOptions({
			input,
			queryKey: orpc.organizationProvider.find.key({
				input: typeof input === "symbol" ? undefined : input,
			}),
			placeholderData: keepPreviousData,
		});
	},

	create: () => {
		return orpc.organizationProvider.create.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.organizationProvider.key(),
				});
			},
		});
	},

	update: () => {
		return orpc.organizationProvider.update.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.organizationProvider.key(),
				});
			},
		});
	},

	delete: () => {
		return orpc.organizationProvider.delete.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.organizationProvider.key(),
				});
			},
		});
	},
} as const;
