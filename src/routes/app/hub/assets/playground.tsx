import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/v4";
import { QdrantPlaygroundForm } from "@/components/documents/playground/qdrant-playground-form";
import QdrantPlaygroundResults from "@/components/documents/playground/qdrant-playground-results";
import { Placeholder } from "@/components/placeholders/placeholder";
import {
	Page,
	PageContent,
	PageDescription,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";

const searchParams = z.object({
	search: z.coerce.string().default(""),
});

export const Route = createFileRoute("/app/hub/assets/playground")({
	validateSearch: searchParams,
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: "Playground",
			},
		],
	}),
});

function RouteComponent() {
	const { search } = Route.useSearch();

	return (
		<Page>
			<PageHeader>
				<PageTitle>Playground</PageTitle>
				<PageDescription>
					Experiment with vector search and retrieval-augmented generation
					(RAG). Type a query and see which chunks of available content are
					found.
				</PageDescription>
			</PageHeader>
			<PageContent className="space-y-6">
				<QdrantPlaygroundForm />
				{search ? (
					<QdrantPlaygroundResults search={search} />
				) : (
					<Placeholder
						title="No Search Results"
						description="Search for chunks to see results."
					/>
				)}
			</PageContent>
		</Page>
	);
}
