import { PackageMinusIcon } from "lucide-react";
import type { HeaderAction } from "@/components/ui/shell/actions";
import { useOrganizationCapabilities } from "@/hooks/authz/use-capabilities";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { hasCapability } from "@/lib/authz/capabilities";
import type { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

/** The user adds from the catalogue to the active organisation, named here. */
export type CatalogueAdder = {
	organisation: string;
};

type OrganizationCapabilities = Awaited<
	ReturnType<typeof orpc.authorization.organizationCapabilities.call>
>["data"]["capabilities"];

/** The adder, given the user's capabilities in the active organisation and its name. */
export const catalogueAdder = (
	capabilities: OrganizationCapabilities | undefined,
	organisation: string | undefined,
): CatalogueAdder | undefined =>
	organisation !== undefined &&
	hasCapability(capabilities, "add_from_catalogue")
		? {
				organisation,
			}
		: undefined;

/** Set when the user may add from the catalogue to the active organisation and remove what it added. */
export const useCatalogueAdder = (): CatalogueAdder | undefined => {
	const { data: capabilities } = useOrganizationCapabilities();
	const organisation = useActiveOrganization().data?.data.name;
	return catalogueAdder(capabilities?.data.capabilities, organisation);
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
