import { createFileRoute } from "@tanstack/react-router";
import { FormPage } from "@/components/forms/form-layout";
import { QuotaPoolForm } from "@/components/quota/form/quota-pool-form";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/quotas/add")({
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: m.common_add_button(),
			},
		],
	}),
});

function RouteComponent() {
	return (
		<FormPage title={m.quotas_add_page_title()}>
			<QuotaPoolForm action="create" />
		</FormPage>
	);
}
