import {
	keepPreviousData,
	type QueryClient,
	type skipToken,
} from "@tanstack/react-query";
import type { OrpcInputs } from "@/lib/orpc/contracts";
import { orpc } from "@/lib/orpc/orpc";

export const courseQueryOptions = {
	list: ({
		input,
	}: {
		input: OrpcInputs["course"]["list"] | typeof skipToken;
	}) => {
		return orpc.course.list.queryOptions({
			input,
			queryKey: orpc.course.list.key({
				input: typeof input === "symbol" ? undefined : input,
			}),
			placeholderData: keepPreviousData,
		});
	},

	find: ({
		input,
	}: {
		input: OrpcInputs["course"]["find"] | typeof skipToken;
	}) => {
		return orpc.course.find.queryOptions({
			input,
			queryKey: orpc.course.find.key({
				input: typeof input === "symbol" ? undefined : input,
			}),
			placeholderData: keepPreviousData,
		});
	},

	create: (queryClient: QueryClient) => {
		return orpc.course.create.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.course.key(),
				});
			},
		});
	},

	update: (queryClient: QueryClient) => {
		return orpc.course.update.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.course.key(),
				});
			},
		});
	},

	delete: (queryClient: QueryClient) => {
		return orpc.course.delete.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.course.key(),
				});
			},
		});
	},
} as const;
