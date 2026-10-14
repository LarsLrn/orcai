import { createFileRoute } from "@tanstack/react-router";
import { ModelForm } from "@/components/model/form/model-form";
import {
	Page,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/models/add")({
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
				<PageTitle>{m.models_add_page_title()}</PageTitle>
			</PageHeader>
			<PageContent>
				<ModelForm action="create" />
			</PageContent>
		</Page>
	);
}
