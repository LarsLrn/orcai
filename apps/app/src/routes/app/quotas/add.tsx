import { createFileRoute } from "@tanstack/react-router";
import { QuotaPoolForm } from "@/components/quota/form/quota-pool-form";
import {
	Page,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
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
		<Page>
			<PageHeader>
				<PageTitle>{m.quotas_add_page_title()}</PageTitle>
			</PageHeader>
			<PageContent>
				<QuotaPoolForm action="create" />
			</PageContent>
		</Page>
	);
}
