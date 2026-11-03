import { Badge } from "@/components/ui/badge";
import type { BadgeItem } from "@/lib/presentation/badge-item";
import { cn } from "@/lib/utils";

/** A `BadgeItem` rendered as a badge. */
const StateBadge = ({
	badge,
	className,
}: {
	badge: BadgeItem;
	className?: string;
}) => (
	<Badge variant={badge.variant} className={cn(badge.className, className)}>
		{badge.icon ? <badge.icon aria-hidden="true" /> : null}
		{badge.label}
	</Badge>
);

export { StateBadge };
