import { createFileRoute } from "@tanstack/react-router";
import { UploadComponent } from "@/components/documents/upload-component";

export const Route = createFileRoute("/app/(assets)/assets/add")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<div>
			<UploadComponent />
		</div>
	);
}
