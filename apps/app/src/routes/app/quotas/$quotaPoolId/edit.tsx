import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { QuotaPoolForm } from "@/components/quota/form/quota-pool-form";
import {
	Page,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/quotas/$quotaPoolId/edit")({
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: "Edit",
			},
		],
	}),
});

function RouteComponent() {
	const { quotaPoolId } = Route.useParams();
	const { data } = useSuspenseQuery(
		orpc.quota.find.queryOptions({
			input: {
				id: quotaPoolId,
			},
		}),
	);

	return (
		<Page>
			<PageHeader>
				<PageTitle>Edit Quota Pool</PageTitle>
			</PageHeader>
			<PageContent>
				<QuotaPoolForm action="update" pool={data.data} />
			</PageContent>
		</Page>
	);
}
