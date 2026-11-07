import type { ProviderId } from "@orcai/core";
import { skipToken, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { TriangleAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

/** One active pool of a search provider, if any; loaders share it with the notice. */
export const searchPoolQuery = (providerId: ProviderId) =>
	orpc.quotaPool.list.queryOptions({
		input: {
			pageIndex: 0,
			pageSize: 1,
			filters: {
				providerId,
				isActive: true,
			},
		},
	});

/** Warns an admin when no active quota pool covers a search provider, which makes every search fail. */
export const SearchPoolNotice = ({
	providerId,
}: {
	providerId: ProviderId | null;
}) => {
	const { data: pools } = useQuery(
		providerId
			? searchPoolQuery(providerId)
			: orpc.quotaPool.list.queryOptions({
					input: skipToken,
				}),
	);

	if (!pools || pools.data.length > 0) {
		return null;
	}

	return (
		<Alert>
			<TriangleAlertIcon />
			<AlertTitle>{m.providers_search_pool_notice_title()}</AlertTitle>
			<AlertDescription>
				{m.providers_search_pool_notice_description()}{" "}
				<Link
					to="/app/quota-pools/add"
					className="underline underline-offset-3"
				>
					{m.providers_search_pool_notice_action()}
				</Link>
			</AlertDescription>
		</Alert>
	);
};
