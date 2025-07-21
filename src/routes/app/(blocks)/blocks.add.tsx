import { createFileRoute } from "@tanstack/react-router";
import { BlockForm } from "@/components/blocks/block-form";

export const Route = createFileRoute("/app/(blocks)/blocks/add")({
	component: RouteComponent,
});

function RouteComponent() {
	return <BlockForm />;
}
