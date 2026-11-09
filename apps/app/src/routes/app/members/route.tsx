import { createFileRoute } from "@tanstack/react-router";
import { LoadingPage } from "@/components/app/loading/loading-page";
import { ensureOrganizationCapability } from "@/lib/router/route-guards";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/members")({
	beforeLoad: async ({ context: { queryClient } }) => {
		await ensureOrganizationCapability({
			queryClient,
			permission: "manage_members",
		});
	},
	head: () => ({
		meta: [
			{
				title: m.members_page_title(),
			},
		],
	}),
	pendingComponent: LoadingPage,
});
