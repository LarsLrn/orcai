import {
	BlocksIcon,
	BookMarkedIcon,
	BotIcon,
	Building2Icon,
	FolderOpenIcon,
	UserIcon,
	UsersIcon,
} from "lucide-react";
import { ROUTES } from "./routes";

export const sidebarInstructorMenu = [
	{
		title: "Courses",
		url: ROUTES.PRIVATE.courses.root.getPath(),
		icon: BookMarkedIcon,
	},
	{
		title: "Resources",
		url: ROUTES.PRIVATE.documents.root.getPath(),
		icon: FolderOpenIcon,
	},
	{
		title: "Bots",
		url: "/app/bots",
		icon: BotIcon,
	},
	{
		title: "Blocks",
		url: "/app/blocks",
		icon: BlocksIcon,
	},
];

export const sidebarOrganizationAdminMenu = [
	{
		title: "Users",
		url: ROUTES.PRIVATE.users.root.getPath(),
		icon: UsersIcon,
	},
	{
		title: "Organisations",
		url: ROUTES.PRIVATE.organizations.root.getPath(),
		icon: Building2Icon,
	},
];

export const sidebarUserMenu = [
	{
		title: "Account",
		url: ROUTES.PRIVATE.app.account.getPath(),
		icon: UserIcon,
	},
];

export const navigationItems = [
	{
		title: "Home",
		href: ROUTES.PUBLIC.root.getPath(),
		description: "",
	},
	{
		title: "About",
		description: "Learn more about our project.",
		items: [
			{
				title: "About us",
				href: "#",
			},
			{
				title: "Funding",
				href: "#",
			},
			{
				title: "Roadmap",
				href: "#",
			},
			{
				title: "Contact us",
				href: "#",
			},
		],
	},
];
