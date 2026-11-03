import { createFileRoute } from "@tanstack/react-router";
import { FormPage } from "@/components/forms/form-layout";
import { ProviderForm } from "@/components/provider/form/provider-form";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/providers/add")({
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: m.providers_add_page_title(),
			},
		],
	}),
});

function RouteComponent() {
	return (
		<FormPage title={m.providers_add_page_title()}>
			<ProviderForm action="create" />
		</FormPage>
	);
}
