import type { LucideIcon } from "lucide-react";

export type BadgeVariant =
	| "default"
	| "brand"
	| "secondary"
	| "destructive"
	| "success"
	| "warning"
	| "danger"
	| "info"
	| "processing"
	| "kind-bot"
	| "kind-behaviour"
	| "kind-repository"
	| "kind-asset"
	| "outline"
	| "ghost"
	| "link";

/** A badge as data: what a presentation helper picks for a state. */
export type BadgeItem = {
	label: string;
	variant: BadgeVariant;
	icon?: LucideIcon;
	className?: string;
};
