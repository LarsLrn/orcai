import { retrievalModeSchema } from "@orcai/schema";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
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
import { orpc } from "@/lib/orpc/orpc";

const searchParams = z.object({
	search: z.coerce.string().default(""),
	retrievalMode: retrievalModeSchema.optional(),
});

export const Route = createFileRoute(
	"/app/hub/repositories/$blockId/playground",
)({
	validateSearch: searchParams,
	loader: async ({ context: { queryClient }, params: { blockId } }) => {
		const repository = await queryClient.ensureQueryData(
			orpc.block.find.queryOptions({
				input: {
					id: blockId,
				},
			}),
		);
		if (
			repository.data.type !== "database" ||
			repository.data.status !== "ready"
		) {
			throw notFound();
		}
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: "Repository Playground",
			},
		],
	}),
});

function RouteComponent() {
	const { blockId } = Route.useParams();
	const { search, retrievalMode } = Route.useSearch();
	const { data: repository } = useSuspenseQuery(
		orpc.block.find.queryOptions({
			input: {
				id: blockId,
			},
		}),
	);

	return (
		<Page>
			<PageHeader>
				<PageTitle>{repository.data.name} Playground</PageTitle>
				<PageDescription>
					Experiment with retrieval against this published repository.
				</PageDescription>
			</PageHeader>
			<PageContent className="space-y-6">
				<QdrantPlaygroundForm />
				{search ? (
					<QdrantPlaygroundResults
						repositoryId={blockId}
						search={search}
						retrievalMode={retrievalMode}
					/>
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
