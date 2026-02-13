import { createFileRoute } from "@tanstack/react-router";
import { ProviderForm } from "@/components/provider/form/provider-form";

export const Route = createFileRoute("/app/providers/add")({
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: "Add",
			},
		],
	}),
});

function RouteComponent() {
	return <ProviderForm action="create" />;
}
