import { createFileRoute } from "@tanstack/react-router";
import { AssetIntakeFlow } from "@/components/documents/shared/asset-intake-flow";
import {
	Page,
	PageContent,
	PageDescription,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { ensureOrganizationCapability } from "@/lib/authz/route-guards";

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
				title: "Add Content",
			},
		],
	}),
});

function RouteComponent() {
	return (
		<Page>
			<PageHeader>
				<PageTitle>Add Content</PageTitle>
				<PageDescription>
					Upload files, then confirm the metadata that should travel with each
					content item wherever it is reused.
				</PageDescription>
			</PageHeader>
			<PageContent>
				<AssetIntakeFlow submitLabel="Save Content" />
			</PageContent>
		</Page>
	);
}
