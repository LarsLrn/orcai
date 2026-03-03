import { createFileRoute } from "@tanstack/react-router";
import {
	Page,
	PageDescription,
	PageHeader,
	PageTitle,
} from "@/components/app/page";
import { UploadComponent } from "@/components/documents/upload-component";

export const Route = createFileRoute("/app/hub/assets/add")({
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: "Add",
			},
		],
	}),
});

function RouteComponent() {
	return (
		<Page>
			<PageHeader>
				<PageTitle>Add Asset</PageTitle>
				<PageDescription>
					Upload new assets to build database blocks and augment your AI chat
					capabilities.
				</PageDescription>
			</PageHeader>
			<UploadComponent />
		</Page>
	);
}
