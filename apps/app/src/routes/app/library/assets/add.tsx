import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AssetIntakeFlow } from "@/components/assets/upload/asset-intake-flow";
import {
	Page,
	PageContent,
	PageDescription,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { ensureOrganizationCapability } from "@/lib/router/route-guards";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/library/assets/add")({
	beforeLoad: async ({ context: { queryClient } }) => {
		await ensureOrganizationCapability({
			queryClient,
			permission: "create_asset",
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
							to: "/app/library/assets",
						})
					}
				/>
			</PageContent>
		</Page>
	);
}
