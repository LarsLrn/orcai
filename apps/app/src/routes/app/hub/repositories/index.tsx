import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	BlocksIcon,
	DatabaseIcon,
	EditIcon,
	FlaskConicalIcon,
	PlusIcon,
	TrashIcon,
} from "lucide-react";
import { BlockCard } from "@/components/blocks/block-card";
import { Placeholder } from "@/components/placeholders/placeholder";
import { buttonVariants } from "@/components/ui/button";
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

const PAGE_SIZE = 100;

export const Route = createFileRoute("/app/hub/repositories/")({
	loader: async ({ context: { queryClient } }) => {
		await Promise.all([
			queryClient.query(
				orpc.block.list.queryOptions({
					input: {
						pageIndex: 0,
						pageSize: PAGE_SIZE,
						filters: {
							type: "database",
							status: "ready",
						},
					},
					staleTime: "static",
				}),
			),
			queryClient.query(
				orpc.block.list.queryOptions({
					input: {
						pageIndex: 0,
						pageSize: PAGE_SIZE,
						filters: {
							type: "database",
							status: "draft",
						},
					},
					staleTime: "static",
				}),
			),
		]);
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: m.blocks_repositories_page_title(),
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

	const { data: repositoryReadyBlocks } = useSuspenseQuery(
		orpc.block.list.queryOptions({
			input: {
				pageIndex: 0,
				pageSize: PAGE_SIZE,
				filters: {
					type: "database",
					status: "ready",
				},
			},
		}),
	);
	const { data: repositoryDraftBlocks } = useSuspenseQuery(
		orpc.block.list.queryOptions({
			input: {
				pageIndex: 0,
				pageSize: PAGE_SIZE,
				filters: {
					type: "database",
					status: "draft",
				},
			},
		}),
	);

	const getCreatedAtValue = (createdAt: Date | null) =>
		createdAt ? +new Date(createdAt) : 0;
	const publishedRepositoryBlocks = [
		...repositoryReadyBlocks.data,
	].sort(
		(a, b) => getCreatedAtValue(b.createdAt) - getCreatedAtValue(a.createdAt),
	);
	const draftRepositoryBlocks = [
		...repositoryDraftBlocks.data,
	].sort(
		(a, b) => getCreatedAtValue(b.createdAt) - getCreatedAtValue(a.createdAt),
	);

	return (
		<div className="space-y-12">
			<Section>
				<SectionHeader>
					<SectionTitle>
						{m.blocks_repositories_published_section_title()}
					</SectionTitle>
					<SectionDescription>
						{m.blocks_repositories_published_section_description()}
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
								{m.blocks_repositories_add_action()}
							</Link>
						</SectionAction>
					) : null}
				</SectionHeader>
				<SectionContent>
					{publishedRepositoryBlocks.length === 0 ? (
						<Placeholder
							Icon={DatabaseIcon}
							tone="repository"
							title={m.blocks_repositories_empty_state_title()}
							description={m.blocks_repositories_empty_state_description()}
							actions={
								canCreateBlock
									? [
											{
												key: "add",
												label: m.blocks_repositories_add_action(),
												icon: BlocksIcon,
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
						<SectionGrid layout="3">
							{publishedRepositoryBlocks.map((block) => (
								<BlockCard
									key={block.id}
									block={block}
									actions={{
										footer: [
											{
												key: "playground",
												label: m.blocks_repositories_playground_action(),
												icon: FlaskConicalIcon,
												linkProps: {
													to: "/app/hub/repositories/$blockId/playground",
													params: {
														blockId: block.id,
													},
												},
											},
										],
									}}
								/>
							))}
						</SectionGrid>
					)}
				</SectionContent>
			</Section>

			{draftRepositoryBlocks.length > 0 && (
				<Section>
					<SectionHeader>
						<SectionTitle>
							{m.blocks_repositories_drafts_section_title()}
						</SectionTitle>
						<SectionDescription>
							{m.blocks_repositories_drafts_section_description()}
						</SectionDescription>
					</SectionHeader>
					<SectionContent>
						<SectionGrid layout="3">
							{draftRepositoryBlocks.map((block) => (
								<DraftRepositoryCard key={block.id} block={block} />
							))}
						</SectionGrid>
					</SectionContent>
				</Section>
			)}
		</div>
	);
}

const DraftRepositoryCard = ({
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
			kind: "repository",
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
									label: m.blocks_repositories_edit_draft_action(),
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
									label: m.blocks_repositories_delete_draft_action(),
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
