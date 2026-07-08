import type { OrganizationCapability } from "@orcai/schema";
import type { LinkProps } from "@tanstack/react-router";
import {
	ArrowLeftRightIcon,
	BlocksIcon,
	BotIcon,
	BrainCircuitIcon,
	Building2Icon,
	DatabaseIcon,
	FolderOpenIcon,
	type LucideIcon,
	ServerCogIcon,
	UserCogIcon,
	UserIcon,
	UsersIcon,
	WalletIcon,
} from "lucide-react";

interface SidebarMenuItem {
	title: string;
	linkProps?: LinkProps;
	icon: LucideIcon;
	requires?: OrganizationCapability;
	items?: Required<Omit<SidebarMenuItem, "items">>[];
}

export const sidebarMenu: SidebarMenuItem[] = [
	{
		title: "Library",
		linkProps: {
			to: "/app/hub",
		},
		icon: BlocksIcon,
		items: [
			{
				title: "Bots",
				requires: "read",
				linkProps: {
					to: "/app/hub/bots",
				},
				icon: BotIcon,
			},
			{
				title: "Behaviour",
				requires: "read",
				linkProps: {
					to: "/app/hub/behaviour",
				},
				icon: BrainCircuitIcon,
			},
			{
				title: "Repositories",
				requires: "read",
				linkProps: {
					to: "/app/hub/repositories",
				},
				icon: DatabaseIcon,
			},
			{
				title: "Content",
				requires: "read",
				linkProps: {
					to: "/app/hub/assets",
				},
				icon: FolderOpenIcon,
			},
		],
	},
	{
		title: "Administration",
		icon: ServerCogIcon,
		items: [
			{
				title: "Users",
				requires: "manage_members",
				linkProps: {
					to: "/app/users",
				},
				icon: UsersIcon,
			},
			{
				title: "Groups",
				requires: "manage_groups",
				linkProps: {
					to: "/app/groups",
				},
				icon: UserCogIcon,
			},
			{
				title: "Quotas",
				requires: "manage_quotas",
				linkProps: {
					to: "/app/quotas",
				},
				icon: WalletIcon,
			},
			{
				title: "Providers",
				requires: "manage_providers",
				linkProps: {
					to: "/app/providers",
				},
				icon: ServerCogIcon,
			},
			{
				title: "Models",
				requires: "manage_models",
				linkProps: {
					to: "/app/models",
				},
				icon: BotIcon,
			},
			{
				title: "Organisations",
				requires: "manage_organization",
				linkProps: {
					to: "/app/orgs",
				},
				icon: Building2Icon,
			},
		],
	},
];

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
