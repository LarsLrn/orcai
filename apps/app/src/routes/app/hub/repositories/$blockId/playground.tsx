import { blockIdSchema, retrievalModeSchema } from "@orcai/schema";
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
import { orNotFound, parseParam } from "@/lib/router/not-found";
import { m } from "@/paraglide/messages";

const searchParams = z.object({
	search: z.coerce.string().default(""),
	retrievalMode: retrievalModeSchema.optional(),
});

export const Route = createFileRoute(
	"/app/hub/repositories/$blockId/playground",
)({
	validateSearch: searchParams,
	params: {
		parse: (params) => ({
			blockId: parseParam(blockIdSchema, params.blockId),
		}),
	},
	loader: async ({ context: { queryClient }, params: { blockId } }) => {
		const repository = await orNotFound(
			queryClient.query(
				orpc.block.find.queryOptions({
					input: {
						id: blockId,
					},
					staleTime: "static",
				}),
			),
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
				title: m.blocks_repositories_playground_page_title(),
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
				<PageTitle>
					{m.blocks_repositories_playground_heading({
						name: repository.data.name,
					})}
				</PageTitle>
				<PageDescription>
					{m.blocks_repositories_playground_description()}
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
						title={m.blocks_repositories_playground_empty_state_title()}
						description={m.blocks_repositories_playground_empty_state_description()}
					/>
				)}
			</PageContent>
		</Page>
	);
}
