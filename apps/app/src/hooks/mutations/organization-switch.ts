import type { Query, QueryClient, QueryKey } from "@tanstack/react-query";

/**
 * Opens a page once the session has switched organisation. Cached queries are
 * keyed without the organisation, so inactive ones go before navigating. The
 * ones mounted then are removed once the navigation unmounted them, or load
 * again when they are still mounted, as on the same page. Only inactive
 * queries are removed, so no mounted observer is left on a removed one.
 * The queries route guards read load again first, so no guard of the new
 * page decides with the old organisation's answer.
 */
export const openAfterOrganizationSwitch = async (
	queryClient: QueryClient,
	{
		navigate,
		guards,
	}: {
		navigate: () => Promise<unknown>;
		guards: readonly QueryKey[];
	},
) => {
	queryClient.removeQueries({
		type: "inactive",
	});
	await Promise.all(
		guards.map((queryKey) =>
			queryClient.refetchQueries({
				queryKey,
			}),
		),
	);
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
