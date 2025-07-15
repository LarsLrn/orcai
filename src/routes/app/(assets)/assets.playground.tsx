import { createFileRoute } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod/v4";
import { QdrantPlaygroundForm } from "@/components/documents/playground/qdrant-playground-form";
import QdrantPlaygroundResults from "@/components/documents/playground/qdrant-playground-results";
import { Placeholder } from "@/components/placeholders/placeholder";

const searchParams = z.object({
	search: z.coerce.string().default(""),
});

export const Route = createFileRoute("/app/(assets)/assets/playground")({
	validateSearch: zodValidator(searchParams),
	component: RouteComponent,
});

function RouteComponent() {
	const { search } = Route.useSearch();

	return (
		<div className="flex flex-col gap-8">
			<QdrantPlaygroundForm />
			{search ? (
				<QdrantPlaygroundResults search={search} />
			) : (
				<Placeholder>Search for chunks</Placeholder>
			)}
		</div>
	);
}
