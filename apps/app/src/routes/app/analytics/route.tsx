import { createFileRoute } from "@tanstack/react-router";
import { LoadingPage } from "@/components/app/loading/loading-page";
import { ensureOrganizationCapability } from "@/lib/authz/route-guards";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/analytics")({
	beforeLoad: async ({ context: { queryClient } }) => {
		await ensureOrganizationCapability({
			queryClient,
			permission: "view_analytics",
		});
	},
	head: () => ({
		meta: [
			{
				title: m.analytics_page_title(),
			},
		],
	}),
	pendingComponent: LoadingPage,
});
