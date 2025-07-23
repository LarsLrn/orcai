import {
	keepPreviousData,
	type QueryClient,
	type skipToken,
} from "@tanstack/react-query";
import { orpc } from "@/lib/orpc/orpc";
import type { OrpcInputs } from "../orpc/contracts";

export const userQueryOptions = {
	list: ({
		input,
	}: {
		input: OrpcInputs["user"]["list"] | typeof skipToken;
	}) => {
		return orpc.user.list.queryOptions({
			input,
			queryKey: orpc.user.list.key({
				input: typeof input === "symbol" ? undefined : input,
			}),
			placeholderData: keepPreviousData,
		});
	},

	find: ({
		input,
	}: {
		input: OrpcInputs["user"]["find"] | typeof skipToken;
	}) => {
		return orpc.user.find.queryOptions({
			input,
			queryKey: orpc.user.find.key({
				input: typeof input === "symbol" ? undefined : input,
			}),
			placeholderData: keepPreviousData,
		});
	},

	updatePassword: () => {
		return orpc.user.updatePassword.mutationOptions();
	},

	setActiveOrganization: (queryClient: QueryClient) => {
		return orpc.user.setActiveOrganization.mutationOptions({
			onSuccess: () => {
				// TODO: Unsure if this is actually needed, but probably a good idea to avoid stale data
				queryClient.clear();
			},
		});
	},

	setTourState: (queryClient: QueryClient) => {
		return orpc.user.setTourState.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					// TODO: Only invalidate a specific user
					queryKey: orpc.user.key(),
				});
			},
		});
	},
} as const;
