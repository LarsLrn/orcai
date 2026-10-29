import type { OrganizationCapability } from "@orcai/schema";
import type { LinkProps } from "@tanstack/react-router";
import {
	ArrowLeftRightIcon,
	Building2Icon,
	ChartColumnIcon,
	CompassIcon,
	CpuIcon,
	LibraryIcon,
	type LucideIcon,
	PlugIcon,
	ServerCogIcon,
	ShieldCogIcon,
	SparklesIcon,
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
		title: m.assistant_name,
		linkProps: {
			to: "/app/assistant",
		},
		icon: SparklesIcon,
	},
	{
		title: m.sidebar_menu_library_item,
		linkProps: {
			to: "/app/library",
		},
		icon: LibraryIcon,
	},
	{
		title: m.sidebar_menu_catalogue_item,
		linkProps: {
			to: "/app/catalogue",
		},
		icon: CompassIcon,
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
				title: m.sidebar_menu_analytics_item,
				requires: "view_analytics",
				linkProps: {
					to: "/app/analytics",
				},
				icon: ChartColumnIcon,
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
				title: m.sidebar_menu_organisation_item,
				requires: "manage_organization",
				linkProps: {
					to: "/app/organization",
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
