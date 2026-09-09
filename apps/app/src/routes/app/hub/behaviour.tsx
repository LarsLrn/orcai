import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { BrainCircuitIcon, EditIcon, PlusIcon, TrashIcon } from "lucide-react";
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

const PAGE_SIZE = 100;

export const Route = createFileRoute("/app/hub/behaviour")({
	loader: async ({ context: { queryClient } }) => {
		await Promise.all([
			queryClient.query(
				orpc.block.list.queryOptions({
					input: {
						pageIndex: 0,
						pageSize: PAGE_SIZE,
						filters: {
							type: "template",
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
							type: "template",
							status: "draft",
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
							type: "imageGeneration",
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
							type: "imageGeneration",
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
				title: "Behaviour",
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

	const { data: templateReadyBlocks } = useSuspenseQuery(
		orpc.block.list.queryOptions({
			input: {
				pageIndex: 0,
				pageSize: PAGE_SIZE,
				filters: {
					type: "template",
					status: "ready",
				},
			},
		}),
	);
	const { data: templateDraftBlocks } = useSuspenseQuery(
		orpc.block.list.queryOptions({
			input: {
				pageIndex: 0,
				pageSize: PAGE_SIZE,
				filters: {
					type: "template",
					status: "draft",
				},
			},
		}),
	);
	const { data: imageGenReadyBlocks } = useSuspenseQuery(
		orpc.block.list.queryOptions({
			input: {
				pageIndex: 0,
				pageSize: PAGE_SIZE,
				filters: {
					type: "imageGeneration",
					status: "ready",
				},
			},
		}),
	);
	const { data: imageGenDraftBlocks } = useSuspenseQuery(
		orpc.block.list.queryOptions({
			input: {
				pageIndex: 0,
				pageSize: PAGE_SIZE,
				filters: {
					type: "imageGeneration",
					status: "draft",
				},
			},
		}),
	);

	const getCreatedAtValue = (createdAt: Date | null) =>
		createdAt ? +new Date(createdAt) : 0;

	const publishedBehaviourBlocks = [
		...templateReadyBlocks.data,
		...imageGenReadyBlocks.data,
	].sort(
		(a, b) => getCreatedAtValue(b.createdAt) - getCreatedAtValue(a.createdAt),
	);
	const draftBehaviourBlocks = [
		...templateDraftBlocks.data,
		...imageGenDraftBlocks.data,
	].sort(
		(a, b) => getCreatedAtValue(b.createdAt) - getCreatedAtValue(a.createdAt),
	);

	return (
		<div className="space-y-12">
			<Section>
				<SectionHeader>
					<SectionTitle>Published</SectionTitle>
					<SectionDescription>
						A behaviour block is a reusable system prompt that sets how a bot
						answers. Published blocks are available to bots and chats.
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
								Add behaviour
							</Link>
						</SectionAction>
					) : null}
				</SectionHeader>
				<SectionContent>
					{publishedBehaviourBlocks.length === 0 ? (
						<Placeholder
							Icon={BrainCircuitIcon}
							tone="behaviour"
							title="No published behaviour yet"
							description="Create and publish a behaviour block to make it available for bots."
							actions={
								canCreateBlock
									? [
											{
												key: "add",
												label: "Add behaviour",
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
						<SectionGrid layout="3">
							{publishedBehaviourBlocks.map((block) => (
								<BlockCard
									key={block.id}
									block={block}
									actions={{
										footer: [],
									}}
								/>
							))}
						</SectionGrid>
					)}
				</SectionContent>
			</Section>

			{draftBehaviourBlocks.length > 0 && (
				<Section>
					<SectionHeader>
						<SectionTitle>Your drafts</SectionTitle>
						<SectionDescription>
							Resume behaviour blocks that are not published yet.
						</SectionDescription>
					</SectionHeader>
					<SectionContent>
						<SectionGrid layout="3">
							{draftBehaviourBlocks.map((block) => (
								<DraftBehaviourCard key={block.id} block={block} />
							))}
						</SectionGrid>
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
			noun: "behaviour block",
			nounPlural: "behaviour blocks",
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
									label: "Edit draft",
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
									label: "Delete draft",
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
