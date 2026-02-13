import { createFileRoute } from "@tanstack/react-router";
import { ModelForm } from "@/components/model/form/model-form";

export const Route = createFileRoute("/app/models/add")({
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
	return <ModelForm action="create" />;
}
