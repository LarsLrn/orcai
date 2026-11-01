import { useQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { PackageMinusIcon } from "lucide-react";
import type { HeaderAction } from "@/components/ui/shell/actions";
import { useOrganizationCapabilities } from "@/hooks/authz/use-capabilities";
import { hasCapability } from "@/lib/authz/capabilities";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

/** The user adds from the catalogue to the active organisation, named here. */
export type CatalogueAdder = {
	organisation: string;
};

/** The active organisation's name. */
export const useActiveOrganizationName = () => {
	const { auth } = useRouteContext({
		from: "/app",
	});
	const { data } = useQuery(
		orpc.organization.find.queryOptions({
			input: {
				id: auth.session.activeOrganizationId,
			},
		}),
	);
	return data?.data.name;
};

/** Set when the user may add from the catalogue to the active organisation and remove what it added. */
export const useCatalogueAdder = (): CatalogueAdder | undefined => {
	const { data: capabilities } = useOrganizationCapabilities();
	const organisation = useActiveOrganizationName();
	return organisation !== undefined &&
		hasCapability(capabilities?.data.capabilities, "add_from_catalogue")
		? {
				organisation,
			}
		: undefined;
};

/** "Remove from <org>": removes a resource the organisation added from the catalogue. */
export const removeAction = (
	adder: CatalogueAdder,
	onRemove: () => void,
): HeaderAction => ({
	key: "remove",
	label: m.catalogue_remove_action({
		organisation: adder.organisation,
	}),
	icon: PackageMinusIcon,
	destructive: true,
	onClick: onRemove,
});
