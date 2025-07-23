import { createFileRoute } from "@tanstack/react-router";
import { UploadComponent } from "@/components/documents/upload-component";

export const Route = createFileRoute("/app/assets/add")({
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
	return <UploadComponent />;
}
