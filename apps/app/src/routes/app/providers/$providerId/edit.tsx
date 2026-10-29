import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { FormPage } from "@/components/forms/form-layout";
import { ProviderForm } from "@/components/provider/form/provider-form";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/providers/$providerId/edit")({
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
	const { providerId } = Route.useParams();
	const { data: provider } = useSuspenseQuery(
		orpc.provider.find.queryOptions({
			input: {
				id: providerId,
			},
		}),
	);

	return (
		<FormPage title={m.providers_edit_page_title()}>
			<ProviderForm action="update" provider={provider.data} />
		</FormPage>
	);
}
