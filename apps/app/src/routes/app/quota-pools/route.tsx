import { createFileRoute } from "@tanstack/react-router";
import { LoadingPage } from "@/components/app/loading/loading-page";
import { ensureOrganizationCapability } from "@/lib/router/route-guards";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/quota-pools")({
	beforeLoad: async ({ context: { queryClient } }) => {
		await ensureOrganizationCapability({
			queryClient,
			permission: "manage_quota_pools",
		});
	},
	head: () => ({
		meta: [
			{
				title: m.quota_pools_route_page_title(),
			},
		],
	}),
	pendingComponent: LoadingPage,
});
