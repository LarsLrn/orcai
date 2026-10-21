import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AssetIntakeFlow } from "@/components/documents/shared/asset-intake-flow";
import {
	Page,
	PageContent,
	PageDescription,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { ensureOrganizationCapability } from "@/lib/authz/route-guards";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/hub/assets/add")({
	loader: async ({ context: { queryClient } }) => {
		await ensureOrganizationCapability({
			queryClient,
			permission: "create_asset",
			redirectTo: "/app/hub/assets",
		});
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: m.assets_add_page_title(),
			},
		],
	}),
});

function RouteComponent() {
	const navigate = useNavigate();

	return (
		<Page>
			<PageHeader>
				<PageTitle>{m.assets_add_page_title()}</PageTitle>
				<PageDescription>{m.assets_add_page_description()}</PageDescription>
			</PageHeader>
			<PageContent>
				<AssetIntakeFlow
					onDone={() =>
						void navigate({
							to: "/app/hub/assets",
						})
					}
				/>
			</PageContent>
		</Page>
	);
}
