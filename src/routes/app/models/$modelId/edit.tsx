import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ManageModel } from "@/components/model/manage-model";
import {
	Page,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/models/$modelId/edit")({
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: "Edit",
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
		<Page>
			<PageHeader>
				<PageTitle>Edit Model</PageTitle>
			</PageHeader>
			<PageContent>
				<ManageModel model={model.data} />
			</PageContent>
		</Page>
	);
}
