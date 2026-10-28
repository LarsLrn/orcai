import { useSuspenseQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	stripSearchParams,
	useNavigate,
} from "@tanstack/react-router";
import { BrainCircuitIcon, EditIcon, PlusIcon, TrashIcon } from "lucide-react";
import { BlockCard } from "@/components/blocks/block-card";
import { Placeholder } from "@/components/placeholders/placeholder";
import { buttonVariants } from "@/components/ui/button";
import {
	CardPager,
	libraryPagingDefaults,
	libraryPagingSchema,
	useClampedPageIndex,
} from "@/components/ui/card-pager";
import {
	Section,
	SectionAction,
	SectionContent,
	SectionDescription,
	SectionGrid,
	SectionHeader,
	SectionTitle,
} from "@/components/ui/shell/section";
import { useOrganizationCapabilities } from "@/hooks/authz/use-capabilities";
import { useDeleteBlocksMutation } from "@/hooks/mutations/use-block-mutations";
import { hasCapability } from "@/lib/authz/capabilities";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

const listInput = (
	status: "ready" | "draft",
	pageIndex: number,
	pageSize: number,
) => ({
	pageIndex,
	pageSize,
	filters: {
		type: "template" as const,
		status,
	},
});

export const Route = createFileRoute("/app/hub/behaviour")({
	validateSearch: libraryPagingSchema,
	search: {
		middlewares: [
			stripSearchParams(libraryPagingDefaults),
		],
	},
	loaderDeps: ({ search: { pageIndex, pageSize, draftPageIndex } }) => ({
		pageIndex,
		pageSize,
		draftPageIndex,
	}),
	loader: async ({ context: { queryClient }, deps }) => {
		await Promise.all([
			queryClient.query(
				orpc.block.list.queryOptions({
					input: listInput("ready", deps.pageIndex, deps.pageSize),
					staleTime: "static",
				}),
			),
			queryClient.query(
				orpc.block.list.queryOptions({
					input: listInput("draft", deps.draftPageIndex, deps.pageSize),
					staleTime: "static",
				}),
			),
		]);
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: m.behaviour_page_title(),
			},
		],
	}),
});

function RouteComponent() {
	const { data: organizationCapabilities } = useOrganizationCapabilities([
		"create_block",
	]);
	const canCreateBlock = hasCapability(
		organizationCapabilities?.data.capabilities,
		"create_block",
	);

	const search = Route.useSearch();
	const { data: published } = useSuspenseQuery(
		orpc.block.list.queryOptions({
			input: listInput("ready", search.pageIndex, search.pageSize),
		}),
	);
	const { data: drafts } = useSuspenseQuery(
		orpc.block.list.queryOptions({
			input: listInput("draft", search.draftPageIndex, search.pageSize),
		}),
	);

	useClampedPageIndex({
		rowCount: published.rowCount,
		pageIndex: search.pageIndex,
		pageSize: search.pageSize,
	});
	useClampedPageIndex({
		rowCount: drafts.rowCount,
		pageIndex: search.draftPageIndex,
		pageSize: search.pageSize,
		indexKey: "draftPageIndex",
	});

	return (
		<div className="space-y-12">
			<Section>
				<SectionHeader>
					<SectionTitle>{m.behaviour_published_title()}</SectionTitle>
					<SectionDescription>
						{m.behaviour_published_description()}
					</SectionDescription>
					{canCreateBlock ? (
						<SectionAction>
							<Link
								to="/app/hub/blocks/add"
								className={buttonVariants({
									size: "sm",
								})}
							>
								<PlusIcon />
								{m.behaviour_add_action()}
							</Link>
						</SectionAction>
					) : null}
				</SectionHeader>
				<SectionContent className="space-y-6">
					{published.rowCount === 0 ? (
						<Placeholder
							Icon={BrainCircuitIcon}
							tone="behaviour"
							title={m.behaviour_empty_state_title()}
							description={m.behaviour_empty_state_description()}
							actions={
								canCreateBlock
									? [
											{
												key: "add",
												label: m.behaviour_add_action(),
												icon: PlusIcon,
												variant: "default",
												linkProps: {
													to: "/app/hub/blocks/add",
												},
											},
										]
									: []
							}
						/>
					) : (
						<>
							<SectionGrid layout="3">
								{published.data.map((block) => (
									<BlockCard
										key={block.id}
										block={block}
										actions={{
											footer: [],
										}}
									/>
								))}
							</SectionGrid>
							<CardPager
								rowCount={published.rowCount}
								pageIndex={search.pageIndex}
								pageSize={search.pageSize}
							/>
						</>
					)}
				</SectionContent>
			</Section>

			{drafts.rowCount > 0 && (
				<Section>
					<SectionHeader>
						<SectionTitle>{m.behaviour_drafts_title()}</SectionTitle>
						<SectionDescription>
							{m.behaviour_drafts_description()}
						</SectionDescription>
					</SectionHeader>
					<SectionContent className="space-y-6">
						<SectionGrid layout="3">
							{drafts.data.map((block) => (
								<DraftBehaviourCard key={block.id} block={block} />
							))}
						</SectionGrid>
						<CardPager
							rowCount={drafts.rowCount}
							pageIndex={search.draftPageIndex}
							pageSize={search.pageSize}
							indexKey="draftPageIndex"
						/>
					</SectionContent>
				</Section>
			)}
		</div>
	);
}

const DraftBehaviourCard = ({
	block,
}: {
	block: React.ComponentProps<typeof BlockCard>["block"];
}) => {
	const navigate = useNavigate();
	const { mutate: deleteBlocks } = useDeleteBlocksMutation(
		{},
		{
			names: [
				block.name,
			],
			kind: "behaviour",
		},
	);

	return (
		<BlockCard
			block={block}
			actions={{
				dropdown: [
					...(hasCapability(block.capabilities, "edit")
						? [
								{
									key: "edit",
									label: m.behaviour_draft_edit_action(),
									icon: EditIcon,
									onClick: () =>
										navigate({
											to: "/app/hub/blocks/$blockId/edit",
											params: {
												blockId: block.id,
											},
										}),
								},
							]
						: []),
					...(hasCapability(block.capabilities, "delete")
						? [
								{
									key: "delete",
									label: m.behaviour_draft_delete_action(),
									icon: TrashIcon,
									onClick: () =>
										deleteBlocks({
											refs: [
												{
													id: block.id,
												},
											],
										}),
								},
							]
						: []),
				],
				footer: [],
			}}
		/>
	);
};
