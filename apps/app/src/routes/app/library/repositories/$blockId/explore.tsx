import { assetIdSchema, retrievalModeSchema } from "@orcai/schema";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { SearchIcon } from "lucide-react";
import { useState } from "react";
import { z } from "zod/v4";
import {
	ExploreBrowse,
	ExploreSearch,
	TOP_K_OPTIONS,
	type TopK,
} from "@/components/documents/explore/explore-results";
import { Button } from "@/components/ui/button";
import { OptionPicker } from "@/components/ui/composed/option-picker";
import { Input } from "@/components/ui/input";
import {
	Page,
	PageContent,
	PageDescription,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

const searchSchema = z.object({
	/** A search query; without one the page browses. */
	q: z.string().optional().catch(undefined),
	mode: retrievalModeSchema.optional().catch(undefined),
	/** One document of the repository. */
	asset: assetIdSchema.optional().catch(undefined),
	k: z
		.union(TOP_K_OPTIONS.map((count) => z.literal(count)))
		.optional()
		.catch(undefined),
});

const ALL_DOCUMENTS = "all";

export const Route = createFileRoute(
	"/app/library/repositories/$blockId/explore",
)({
	validateSearch: searchSchema,
	// The parent route has loaded the repository, or answered not found.
	loader: async ({ context: { queryClient }, params: { blockId } }) => {
		const repository = await queryClient.query(
			orpc.block.find.queryOptions({
				input: {
					id: blockId,
				},
			}),
		);
		if (repository.data.status !== "ready") {
			throw notFound();
		}
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: m.blocks_explore_page_title(),
			},
		],
	}),
});

function RouteComponent() {
	const { blockId } = Route.useParams();
	const { q, mode = "hybrid", asset, k = 10 } = Route.useSearch();
	const navigate = Route.useNavigate();
	const { data: repository } = useSuspenseQuery(
		orpc.block.find.queryOptions({
			input: {
				id: blockId,
			},
		}),
	);

	const documents = [
		{
			value: ALL_DOCUMENTS,
			label: m.blocks_explore_document_all(),
		},
		...(repository.assets ?? []).map((document) => ({
			value: document.id as string,
			label: document.title,
		})),
	];
	const assetId = repository.assets?.find(
		(document) => document.id === asset,
	)?.id;

	const hint = q
		? m.blocks_explore_search_hint()
		: assetId
			? m.blocks_explore_browse_document_hint()
			: m.blocks_explore_browse_all_hint();

	return (
		<Page>
			<PageHeader>
				<PageTitle>
					{m.blocks_explore_heading({
						name: repository.data.name,
					})}
				</PageTitle>
				<PageDescription>{m.blocks_explore_description()}</PageDescription>
			</PageHeader>
			<PageContent className="space-y-6">
				<div className="space-y-3">
					<SearchForm
						// A new query in the URL, from a search or Back, resets the draft.
						key={q ?? ""}
						query={q}
						onSearch={(next) =>
							navigate({
								search: (previous) => ({
									...previous,
									q: next || undefined,
								}),
							})
						}
					/>
					<div className="flex flex-wrap items-center gap-2">
						<OptionPicker
							options={documents}
							value={assetId ?? ALL_DOCUMENTS}
							onChange={(value) =>
								navigate({
									search: (previous) => ({
										...previous,
										asset:
											value === ALL_DOCUMENTS
												? undefined
												: assetIdSchema.parse(value),
									}),
								})
							}
							aria-label={m.blocks_explore_document_label()}
							className="w-64 max-w-full"
						/>
						{q ? (
							<>
								<OptionPicker
									options={[
										{
											value: "hybrid",
											label: m.blocks_retrieval_mode_hybrid_label(),
										},
										{
											value: "dense",
											label: m.blocks_retrieval_mode_dense_label(),
										},
										{
											value: "sparse",
											label: m.blocks_retrieval_mode_sparse_label(),
										},
									]}
									value={mode}
									onChange={(value) =>
										navigate({
											search: (previous) => ({
												...previous,
												mode: value,
											}),
										})
									}
									aria-label={m.blocks_explore_mode_label()}
								/>
								<OptionPicker
									options={TOP_K_OPTIONS.map((count) => ({
										value: String(count),
										label: m.blocks_explore_top_k_option({
											count,
										}),
									}))}
									value={String(k)}
									onChange={(value) =>
										navigate({
											search: (previous) => ({
												...previous,
												k: Number(value) as TopK,
											}),
										})
									}
									aria-label={m.blocks_explore_top_k_label()}
								/>
							</>
						) : null}
					</div>
					<p className="text-muted-foreground text-sm">{hint}</p>
				</div>
				{q ? (
					<ExploreSearch
						repositoryId={blockId}
						query={q}
						mode={mode}
						assetId={assetId}
						topK={k}
					/>
				) : (
					<ExploreBrowse repositoryId={blockId} assetId={assetId} />
				)}
			</PageContent>
		</Page>
	);
}

const SearchForm = ({
	query,
	onSearch,
}: {
	query?: string;
	onSearch: (query: string) => void;
}) => {
	const [draft, setDraft] = useState(query ?? "");

	return (
		<form
			className="flex flex-wrap items-center gap-2"
			onSubmit={(event) => {
				event.preventDefault();
				onSearch(draft.trim());
			}}
		>
			<Input
				type="search"
				value={draft}
				onChange={(event) => setDraft(event.target.value)}
				aria-label={m.blocks_explore_search_label()}
				placeholder={m.blocks_explore_search_placeholder()}
				className="min-w-48 flex-1"
			/>
			<Button type="submit">
				<SearchIcon />
				{m.blocks_explore_search_submit()}
			</Button>
		</form>
	);
};
