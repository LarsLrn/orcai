import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LoadingPage } from "@/components/app/loading/loading-page";
import { findBlockSection } from "@/lib/navigation/block-section";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/hub/blocks")({
	staticData: {
		breadcrumbTo: (matches) => findBlockSection(matches)?.to,
	},
	head: ({ matches }) => ({
		meta: [
			{
				title: findBlockSection(matches)?.label() ?? m.blocks_page_title(),
			},
		],
	}),
	component: RouteComponent,
	pendingComponent: LoadingPage,
});

function RouteComponent() {
	return <Outlet />;
}
