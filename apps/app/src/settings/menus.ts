import type { OrganizationCapability } from "@orcai/schema";
import type { LinkProps } from "@tanstack/react-router";
import {
	ArrowLeftRightIcon,
	BlocksIcon,
	BotIcon,
	BrainCircuitIcon,
	Building2Icon,
	CpuIcon,
	DatabaseIcon,
	FolderOpenIcon,
	type LucideIcon,
	PlugIcon,
	ServerCogIcon,
	ShieldCogIcon,
	UserCogIcon,
	UserIcon,
	UsersIcon,
	WalletIcon,
} from "lucide-react";
import { m } from "@/paraglide/messages";

interface SidebarMenuItem {
	title: () => string;
	linkProps?: LinkProps;
	icon: LucideIcon;
	requires?: OrganizationCapability;
	items?: (Required<Pick<SidebarMenuItem, "title" | "linkProps" | "icon">> &
		Pick<SidebarMenuItem, "requires">)[];
}

export const sidebarMenu: SidebarMenuItem[] = [
	{
		title: m.sidebar_menu_library_item,
		linkProps: {
			to: "/app/hub",
		},
		icon: BlocksIcon,
		items: [
			{
				title: m.sidebar_menu_bots_item,
				requires: "read",
				linkProps: {
					to: "/app/hub/bots",
				},
				icon: BotIcon,
			},
			{
				title: m.sidebar_menu_behaviour_item,
				requires: "read",
				linkProps: {
					to: "/app/hub/behaviour",
				},
				icon: BrainCircuitIcon,
			},
			{
				title: m.sidebar_menu_repositories_item,
				requires: "read",
				linkProps: {
					to: "/app/hub/repositories",
				},
				icon: DatabaseIcon,
			},
			{
				title: m.sidebar_menu_assets_item,
				requires: "read",
				linkProps: {
					to: "/app/hub/assets",
				},
				icon: FolderOpenIcon,
			},
		],
	},
	{
		title: m.sidebar_menu_administration_item,
		icon: ShieldCogIcon,
		items: [
			{
				title: m.sidebar_menu_users_item,
				requires: "manage_members",
				linkProps: {
					to: "/app/users",
				},
				icon: UsersIcon,
			},
			{
				title: m.sidebar_menu_groups_item,
				requires: "manage_groups",
				linkProps: {
					to: "/app/groups",
				},
				icon: UserCogIcon,
			},
			{
				title: m.sidebar_menu_quotas_item,
				requires: "manage_quotas",
				linkProps: {
					to: "/app/quotas",
				},
				icon: WalletIcon,
			},
			{
				title: m.sidebar_menu_providers_item,
				requires: "manage_providers",
				linkProps: {
					to: "/app/providers",
				},
				icon: PlugIcon,
			},
			{
				title: m.sidebar_menu_models_item,
				requires: "manage_models",
				linkProps: {
					to: "/app/models",
				},
				icon: CpuIcon,
			},
			{
				title: m.sidebar_menu_organisations_item,
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
		title: m.user_menu_account_item,
		linkProps: {
			to: "/app/account",
		},
		icon: UserIcon,
	},
	{
		title: m.user_menu_switch_organisation_item,
		linkProps: {
			to: "/select-organization",
		},
		icon: ArrowLeftRightIcon,
	},
];

export const instanceAdministrationUserMenuItem: SidebarMenuItem = {
	title: m.user_menu_manage_instance_item,
	linkProps: {
		to: "/instance",
	},
	icon: ServerCogIcon,
};
