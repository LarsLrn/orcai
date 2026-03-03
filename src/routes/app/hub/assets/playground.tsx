import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/v4";
import {
	Page,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/app/page";
import { QdrantPlaygroundForm } from "@/components/documents/playground/qdrant-playground-form";
import QdrantPlaygroundResults from "@/components/documents/playground/qdrant-playground-results";
import { Placeholder } from "@/components/placeholders/placeholder";

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
			</PageHeader>
			<PageContent>
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
