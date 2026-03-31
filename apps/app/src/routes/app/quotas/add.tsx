import { createFileRoute } from "@tanstack/react-router";
import { QuotaPoolForm } from "@/components/quota/form/quota-pool-form";
import {
	Page,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";

export const Route = createFileRoute("/app/quotas/add")({
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
				<PageTitle>Add Quota Pool</PageTitle>
			</PageHeader>
			<PageContent>
				<QuotaPoolForm action="create" />
			</PageContent>
		</Page>
	);
}
