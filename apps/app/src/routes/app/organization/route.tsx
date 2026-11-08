import { createFileRoute } from "@tanstack/react-router";
import { LoadingPage } from "@/components/app/loading/loading-page";
import { ensureOrganizationCapability } from "@/lib/authz/route-guards";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/organization")({
	beforeLoad: async ({ context: { queryClient } }) => {
		await ensureOrganizationCapability({
			queryClient,
			permission: "manage_organization",
		});
	},
	head: () => ({
		meta: [
			{
				title: m.orgs_settings_page_title(),
			},
		],
	}),
	pendingComponent: LoadingPage,
});
