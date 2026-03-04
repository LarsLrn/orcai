import type { LinkProps } from "@tanstack/react-router";
import {
	ArrowLeftRightIcon,
	BlocksIcon,
	BookMarkedIcon,
	BotIcon,
	Building2Icon,
	FolderOpenIcon,
	type LucideIcon,
	ServerCogIcon,
	UserCogIcon,
	UserIcon,
	UsersIcon,
} from "lucide-react";

interface SidebarMenuItem {
	title: string;
	linkProps: LinkProps;
	icon: LucideIcon;
	items?: Omit<SidebarMenuItem, "items">[];
}

export const sidebarMenu = [
	{
		title: "Hub",
		linkProps: {
			to: "/app/hub",
		},
		icon: BlocksIcon,
		items: [
			{
				title: "Courses",
				linkProps: {
					to: "/app/hub/courses",
				},
				icon: BookMarkedIcon,
			},
			{
				title: "Assets",
				linkProps: {
					to: "/app/hub/assets",
				},
				icon: FolderOpenIcon,
			},
			{
				title: "Bots",
				linkProps: {
					to: "/app/hub/bots",
				},
				icon: BotIcon,
			},
			{
				title: "Blocks",
				linkProps: {
					to: "/app/hub/blocks",
				},
				icon: BlocksIcon,
			},
		],
	},
	{
		title: "Users",
		linkProps: {
			to: "/app/users",
		},
		icon: UsersIcon,
	},
	{
		title: "Groups",
		linkProps: {
			to: "/app/groups",
		},
		icon: UserCogIcon,
	},
	{
		title: "Providers",
		linkProps: {
			to: "/app/providers",
		},
		icon: ServerCogIcon,
	},
	{
		title: "Models",
		linkProps: {
			to: "/app/models",
		},
		icon: BotIcon,
	},
	{
		title: "Organisations",
		linkProps: {
			to: "/app/orgs",
		},
		icon: Building2Icon,
	},
] satisfies SidebarMenuItem[];

export const sidebarUserMenu: SidebarMenuItem[] = [
	{
		title: "Account",
		linkProps: {
			to: "/app/account",
		},
		icon: UserIcon,
	},
	{
		title: "Switch Organisation",
		linkProps: {
			to: "/select-organization",
		},
		icon: ArrowLeftRightIcon,
	},
];
