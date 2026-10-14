import { createFileRoute } from "@tanstack/react-router";
import { ProviderForm } from "@/components/provider/form/provider-form";
import {
	Page,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/providers/add")({
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
				<PageTitle>{m.providers_add_page_title()}</PageTitle>
			</PageHeader>
			<PageContent>
				<ProviderForm action="create" />
			</PageContent>
		</Page>
	);
}
