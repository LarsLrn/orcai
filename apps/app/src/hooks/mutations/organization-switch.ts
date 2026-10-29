import type { Query, QueryClient } from "@tanstack/react-query";

/**
 * Opens a page once the session has switched organisation. Cached queries are
 * keyed without the organisation, so inactive ones go before navigating. The
 * ones mounted then are removed once the navigation unmounted them, or load
 * again when they are still mounted, as on the same page. Only inactive
 * queries are removed, so no mounted observer is left on a removed one.
 */
export const openAfterOrganizationSwitch = async (
	queryClient: QueryClient,
	{
		refetchSession,
		navigate,
	}: {
		refetchSession: () => Promise<unknown>;
		navigate: () => Promise<unknown>;
	},
) => {
	await refetchSession();
	queryClient.removeQueries({
		type: "inactive",
	});
	const previous = new Set(
		queryClient.getQueryCache().findAll({
			type: "active",
		}),
	);
	await navigate();
	const fromBefore = (query: Query) => previous.has(query);
	queryClient.removeQueries({
		type: "inactive",
		predicate: fromBefore,
	});
	void queryClient.resetQueries({
		type: "active",
		predicate: fromBefore,
	});
};
