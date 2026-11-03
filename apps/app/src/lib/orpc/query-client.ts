import { createHydrationOptions } from "@orpc/tanstack-query";
import { MutationCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { reasonMessageOf } from "@/lib/errors/describe-error";

declare module "@tanstack/react-query" {
	interface Register {
		mutationMeta: {
			/** Titles the toast a failure shows, for a mutation without its own toasts. */
			errorToast?: string;
		};
	}
}

export const createQueryClient = () =>
	new QueryClient({
		mutationCache: new MutationCache({
			onError: (error, _variables, _context, mutation) => {
				const title = mutation.meta?.errorToast;
				if (title) {
					toast.error(title, {
						description: reasonMessageOf(error),
					});
				}
			},
		}),
		defaultOptions: {
			queries: {
				staleTime: 60 * 1000, // > 0 to prevent immediate refetching on mount
			},
			...createHydrationOptions(),
		},
	});
