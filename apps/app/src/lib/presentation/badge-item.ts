import type { LucideIcon } from "lucide-react";
import type { Badge } from "@/components/ui/badge";

/** A badge as data: what a presentation helper picks for a state. */
export type BadgeItem = {
	label: string;
	variant: React.ComponentProps<typeof Badge>["variant"];
	icon?: LucideIcon;
	className?: string;
};
