import {
	createFileRoute,
	type LinkProps,
	Outlet,
	useNavigate,
	useRouterState,
} from "@tanstack/react-router";
import {
	DatabaseIcon,
	type LucideIcon,
	MailIcon,
	ShieldIcon,
	UserIcon,
} from "lucide-react";
import { LoadingPage } from "@/components/app/loading/loading-page";
import { OptionPicker } from "@/components/ui/composed/option-picker";
import { Page, PageHeader, PageTitle } from "@/components/ui/shell/page";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { m } from "@/paraglide/messages";

const ACCOUNT_ROUTES = [
	{
		value: "profile",
		to: "/app/account",
		Icon: UserIcon,
	},
	{
		value: "security",
		to: "/app/account/security",
		Icon: ShieldIcon,
	},
	{
		value: "invitations",
		to: "/app/account/invitations",
		Icon: MailIcon,
	},
	{
		value: "data",
		to: "/app/account/data",
		Icon: DatabaseIcon,
	},
] satisfies {
	value: string;
	to: LinkProps["to"];
	Icon: LucideIcon;
}[];

type TabValue = (typeof ACCOUNT_ROUTES)[number]["value"];

const getAccountRouteLabel = (value: TabValue) => {
	switch (value) {
		case "security":
			return m.account_tab_security_label();
		case "invitations":
			return m.account_tab_invitations_label();
		case "data":
			return m.account_tab_data_label();
		default:
			return m.account_tab_profile_label();
	}
};

function getActiveTab(pathname: string): TabValue {
	const match = ACCOUNT_ROUTES.find(
		(route) => route.value !== "profile" && pathname.startsWith(route.to),
	);
	return match?.value ?? "profile";
}

export const Route = createFileRoute("/app/account")({
	head: () => ({
		meta: [
			{
				title: m.account_page_title(),
			},
		],
	}),
	component: RouteComponent,
	pendingComponent: LoadingPage,
});

function RouteComponent() {
	const navigate = useNavigate();
	const activeTab = getActiveTab(
		useRouterState({
			select: (state) => state.location.pathname,
		}),
	);
	const accountRouteItems = ACCOUNT_ROUTES.map((route) => ({
		...route,
		label: getAccountRouteLabel(route.value),
	}));
	const navigateToRoute = (value: string | null) => {
		if (!value) return;
		const route = ACCOUNT_ROUTES.find((candidate) => candidate.value === value);
		if (route)
			navigate({
				to: route.to,
			});
	};

	return (
		<Page>
			<div className="@container flex flex-col gap-6">
				<PageHeader>
					<PageTitle>{m.account_page_title()}</PageTitle>
				</PageHeader>
				<OptionPicker
					options={accountRouteItems}
					value={activeTab}
					onChange={navigateToRoute}
					aria-label={m.account_section_switcher_aria_label()}
					className="@xl:hidden w-full"
				/>
				<Tabs
					className="@xl:flex hidden"
					value={activeTab}
					onValueChange={navigateToRoute}
				>
					<TabsList>
						{accountRouteItems.map((route) => (
							<TabsTrigger key={route.value} value={route.value}>
								<route.Icon />
								{route.label}
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs>
			</div>

			<Outlet />
		</Page>
	);
}
