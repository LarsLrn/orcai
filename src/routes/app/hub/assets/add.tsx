import { createFileRoute } from "@tanstack/react-router";
import { AssetIntakeFlow } from "@/components/documents/shared/asset-intake-flow";
import {
	Page,
	PageContent,
	PageDescription,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";

export const Route = createFileRoute("/app/hub/assets/add")({
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: "Add Asset",
			},
		],
	}),
});

function RouteComponent() {
	return (
		<Page>
			<PageHeader>
				<PageTitle>Add Document</PageTitle>
				<PageDescription>
					Upload files, then confirm the metadata that should travel with each
					document wherever it is reused.
				</PageDescription>
			</PageHeader>
			<PageContent>
				<AssetIntakeFlow submitLabel="Save Documents" />
			</PageContent>
		</Page>
	);
}
