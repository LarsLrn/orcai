import type { ResourceRef } from "@orcai/schema";
import { StoreIcon } from "lucide-react";
import type { HeaderAction } from "@/components/ui/shell/actions";
import {
	useResourceVisibility,
	useSetResourceListing,
} from "@/hooks/authz/use-resource-access";
import { m } from "@/paraglide/messages";

/**
 * Lists the resource in the catalogue or takes it out, for those who manage
 * its access. A document is never listed on its own, so it only offers to
 * take out one listed earlier.
 */
export const useListingAction = (
	resourceRef: ResourceRef,
	{
		enabled,
	}: {
		enabled: boolean;
	},
): HeaderAction | false => {
	const visibility = useResourceVisibility(resourceRef, {
		enabled,
	});
	const listing = useSetResourceListing();
	const current = visibility.data?.data.visibility;
	if (!enabled || !current) {
		return false;
	}
	const listed = current === "public";
	if (resourceRef.type === "asset" && !listed) {
		return false;
	}

	return {
		key: "listing",
		label: listed ? m.access_unlist_action() : m.access_list_action(),
		icon: StoreIcon,
		overflow: true,
		loading: listing.isPending,
		onClick: () =>
			void listing.setListing(resourceRef, listed ? "private" : "public"),
	};
};
