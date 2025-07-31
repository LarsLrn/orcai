import type { LinkProps } from "@tanstack/react-router";
import {
	ArrowLeftRightIcon,
	BlocksIcon,
	BookMarkedIcon,
	BotIcon,
	Building2Icon,
	FolderOpenIcon,
	type LucideIcon,
	UserIcon,
	UsersIcon,
} from "lucide-react";

interface SidebarMenuItem {
	title: string;
	linkProps: LinkProps;
	icon: LucideIcon;
}

export const sidebarMenu: SidebarMenuItem[] = [
	{
		title: "Courses",
		linkProps: { to: "/app/courses" },
		icon: BookMarkedIcon,
	},
	{
		title: "Assets",
		linkProps: { to: "/app/assets" },
		icon: FolderOpenIcon,
	},
	{
		title: "Bots",
		linkProps: { to: "/app/bots" },
		icon: BotIcon,
	},
	{
		title: "Blocks",
		linkProps: { to: "/app/blocks" },
		icon: BlocksIcon,
	},
	{
		title: "Users",
		linkProps: { to: "/app/users" },
		icon: UsersIcon,
	},
	{
		title: "Organisations",
		linkProps: { to: "/app/orgs" },
		icon: Building2Icon,
	},
];

export const sidebarUserMenu: SidebarMenuItem[] = [
	{
		title: "Account",
		linkProps: { to: "/app/account" },
		icon: UserIcon,
	},
	{
		title: "Switch Organisation",
		linkProps: { to: "/select-organization" },
		icon: ArrowLeftRightIcon,
	},
];
