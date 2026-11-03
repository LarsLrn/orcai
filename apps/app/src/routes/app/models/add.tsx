import { createFileRoute } from "@tanstack/react-router";
import { FormPage } from "@/components/forms/form-layout";
import { ModelForm } from "@/components/model/form/model-form";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/models/add")({
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: m.models_add_page_title(),
			},
		],
	}),
});

function RouteComponent() {
	return (
		<FormPage title={m.models_add_page_title()}>
			<ModelForm action="create" />
		</FormPage>
	);
}
