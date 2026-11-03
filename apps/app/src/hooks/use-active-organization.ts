import type { OrganizationId } from "@orcai/core";
import { skipToken, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { useAuthenticatedRouteContext } from "@/hooks/authz/use-authenticated-route-context";
import { orpc } from "@/lib/orpc/orpc";

/** The active organisation. `/app` loads it, so the server renders with it. */
export const activeOrganizationQuery = (id: OrganizationId) =>
	orpc.organization.find.queryOptions({
		input: {
			id,
		},
	});

/** The active organisation, once one is selected. */
export const useActiveOrganization = () => {
	const { auth } = useAuthenticatedRouteContext();
	const id = auth.session.activeOrganizationId;
	return useQuery(
		orpc.organization.find.queryOptions({
			input: id
				? {
						id,
					}
				: skipToken,
		}),
	);
};

/** The active organisation inside `/app`, which always has one. */
export const useSuspenseActiveOrganization = () => {
	const { auth } = useRouteContext({
		from: "/app",
	});
	return useSuspenseQuery(
		activeOrganizationQuery(auth.session.activeOrganizationId),
	).data.data;
};
