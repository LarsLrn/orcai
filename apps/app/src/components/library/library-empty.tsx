import type { LibraryScope } from "@orcai/schema";
import { LibraryIcon, UserIcon } from "lucide-react";
import { LibraryNewMenu } from "@/components/library/library-new-menu";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { useOrganizationCapabilities } from "@/hooks/authz/use-capabilities";
import { hasCapability } from "@/lib/authz/capabilities";
import { m } from "@/paraglide/messages";

/**
 * Nothing to show yet: in the whole library, or of the user's own with Mine.
 * The copy depends on whether the user may create anything.
 */
export const LibraryEmpty = ({
	scope,
	title,
}: {
	scope: LibraryScope;
	/** A kind's own title, such as "No bots yet"; the library's otherwise. */
	title?: string;
}) => {
	const { data } = useOrganizationCapabilities([
		"create_bot",
		"create_block",
		"create_asset",
	]);
	const canCreate = (
		[
			"create_bot",
			"create_block",
			"create_asset",
		] as const
	).some((capability) => hasCapability(data?.data.capabilities, capability));
	const mine = scope === "edit";

	return (
		<Empty className="border border-dashed">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					{mine ? <UserIcon /> : <LibraryIcon />}
				</EmptyMedia>
				<EmptyTitle>
					{mine
						? m.library_mine_empty_title()
						: (title ?? m.library_empty_title())}
				</EmptyTitle>
				<EmptyDescription>
					{mine
						? m.library_mine_empty_description()
						: canCreate
							? m.library_empty_create_description()
							: m.library_empty_read_description()}
				</EmptyDescription>
			</EmptyHeader>
			{canCreate ? (
				<EmptyContent>
					<LibraryNewMenu />
				</EmptyContent>
			) : null}
		</Empty>
	);
};
