import { createFileRoute } from "@tanstack/react-router";
import { ManagerHome } from "@/components/app/home/manager-home";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/_home/manage")({
	head: () => ({
		meta: [
			{
				title: m.home_view_manage_tab(),
			},
		],
	}),
	component: ManagerHome,
});
