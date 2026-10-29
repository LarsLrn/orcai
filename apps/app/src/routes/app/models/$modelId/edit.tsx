import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { FormPage } from "@/components/forms/form-layout";
import { ModelForm } from "@/components/model/form/model-form";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/models/$modelId/edit")({
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
	const { modelId } = Route.useParams();
	const { data: model } = useSuspenseQuery(
		orpc.model.find.queryOptions({
			input: {
				id: modelId,
			},
		}),
	);

	return (
		<FormPage title={m.models_edit_page_title()}>
			<ModelForm action="update" model={model.data} />
		</FormPage>
	);
}
