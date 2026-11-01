import { Link } from "@tanstack/react-router";
import { use, useId } from "react";
import { buttonVariants } from "@/components/ui/button";
import {
	Item,
	ItemActions,
	ItemContent,
	ItemDescription,
	ItemMedia,
	ItemTitle,
} from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import type { WrittenResource } from "@/lib/ai/tools/declaration";
import { libraryLink } from "@/lib/navigation/library-link";
import { RESOURCE_KINDS } from "@/lib/presentation/resource-kind";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { WrittenResourcesContext } from "./written-resources";

/**
 * A library resource the Assistant created or changed: its kind, and its
 * current name with a link to it while the user can still read it. Until the
 * turn settles the card shows the name the call wrote, without the link.
 */
export const ResourceCard = ({
	resource,
	settled,
}: {
	resource: WrittenResource;
	settled: boolean;
}) => {
	const found = use(WrittenResourcesContext);
	const { label, Icon, well } = RESOURCE_KINDS[resource.kind];
	const titleId = useId();
	const name = settled ? found?.get(resource.id) : resource.name;
	const looking = settled && found === undefined;

	return (
		<Item
			variant="outline"
			size="sm"
			className="not-prose"
			role="group"
			aria-labelledby={titleId}
			aria-busy={looking || undefined}
		>
			<ItemMedia variant="image" className={cn("[&_svg]:size-4", well)}>
				<Icon aria-hidden="true" />
			</ItemMedia>
			<ItemContent className="min-w-0">
				{looking ? (
					<Skeleton id={titleId} className="h-5 w-40" />
				) : (
					<ItemTitle
						id={titleId}
						className={cn("block truncate", !name && "text-muted-foreground")}
					>
						{name ?? m.assistant_resource_card_unavailable()}
					</ItemTitle>
				)}
				<ItemDescription>{label()}</ItemDescription>
			</ItemContent>
			{settled && name && (
				<ItemActions>
					<Link
						{...libraryLink(resource)}
						className={buttonVariants({
							variant: "outline",
							size: "sm",
						})}
					>
						{m.assistant_resource_card_open_action()}
					</Link>
				</ItemActions>
			)}
		</Item>
	);
};
