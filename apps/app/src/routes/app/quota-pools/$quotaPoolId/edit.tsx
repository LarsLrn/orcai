import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { FormPage } from "@/components/forms/form-layout";
import { QuotaPoolForm } from "@/components/quota/form/quota-pool-form";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/quota-pools/$quotaPoolId/edit")({
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: m.common_edit_button(),
			},
		],
	}),
});

function RouteComponent() {
	const { quotaPoolId } = Route.useParams();
	const { data } = useSuspenseQuery(
		orpc.quotaPool.find.queryOptions({
			input: {
				id: quotaPoolId,
			},
		}),
	);

	return (
		<FormPage title={m.quota_pools_edit_page_title()}>
			<QuotaPoolForm action="update" pool={data.data} />
		</FormPage>
	);
}
