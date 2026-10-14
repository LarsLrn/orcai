import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ProviderForm } from "@/components/provider/form/provider-form";
import {
	Page,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
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
		<Page>
			<PageHeader>
				<PageTitle>{m.providers_edit_page_title()}</PageTitle>
			</PageHeader>
			<PageContent>
				<ProviderForm action="update" provider={provider.data} />
			</PageContent>
		</Page>
	);
}
