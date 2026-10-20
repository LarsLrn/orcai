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
import { m } from "@/paraglide/messages";

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
				<SectionContent>
					{templateReadyBlocks.data.length === 0 ? (
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
						<SectionGrid layout="3">
							{templateReadyBlocks.data.map((block) => (
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

			{templateDraftBlocks.data.length > 0 && (
				<Section>
					<SectionHeader>
						<SectionTitle>{m.behaviour_drafts_title()}</SectionTitle>
						<SectionDescription>
							{m.behaviour_drafts_description()}
						</SectionDescription>
					</SectionHeader>
					<SectionContent>
						<SectionGrid layout="3">
							{templateDraftBlocks.data.map((block) => (
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
