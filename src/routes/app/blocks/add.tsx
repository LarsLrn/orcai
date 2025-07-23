import { createFileRoute } from "@tanstack/react-router";
import { BlockForm } from "@/components/blocks/block-form";

export const Route = createFileRoute("/app/blocks/add")({
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
	return <BlockForm />;
}
