import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ManageProvider } from "@/components/provider/manage-provider";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/providers/$providerId/edit")({
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
	const { providerId } = Route.useParams();
	const { data: provider } = useSuspenseQuery(
		orpc.provider.find.queryOptions({
			input: { id: providerId },
		}),
	);

	return <ManageProvider provider={provider.data} />;
}
