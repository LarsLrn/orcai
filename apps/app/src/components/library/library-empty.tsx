import type { LibraryScope } from "@orcai/schema";
import { CompassIcon, LibraryIcon, UserIcon } from "lucide-react";
import { LibraryNewMenu } from "@/components/library/library-new-menu";
import { Placeholder } from "@/components/placeholders/placeholder";
import { useOrganizationCapabilities } from "@/hooks/authz/use-capabilities";
import { hasCapability } from "@/lib/authz/capabilities";
import { m } from "@/paraglide/messages";

/**
 * Nothing to show yet: in the whole library, or of the user's own with Mine.
 * The copy depends on whether the user may create anything; the catalogue
 * offers what other organisations share.
 */
export const LibraryEmpty = ({
	scope,
	title,
}: {
	scope: LibraryScope;
	/** A kind's own title, such as "No bots yet"; the library's otherwise. */
	title?: string;
}) => {
	const { data } = useOrganizationCapabilities();
	const canCreate = (
		[
			"create_bot",
			"create_block",
			"create_asset",
		] as const
	).some((capability) => hasCapability(data?.data.capabilities, capability));
	const mine = scope === "edit";

	return (
		<Placeholder
			className="border"
			Icon={mine ? UserIcon : LibraryIcon}
			title={
				mine ? m.library_mine_empty_title() : (title ?? m.library_empty_title())
			}
			description={
				mine
					? m.library_mine_empty_description()
					: canCreate
						? m.library_empty_create_description()
						: m.library_empty_read_description()
			}
			actions={[
				{
					key: "catalogue",
					label: m.library_browse_catalogue_action(),
					icon: CompassIcon,
					size: "default",
					linkProps: {
						to: "/app/catalogue",
					},
				},
			]}
		>
			{canCreate ? <LibraryNewMenu /> : null}
		</Placeholder>
	);
};
