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
import { useDeleteBlocksMutation } from "@/hooks/mutations/use-block-mutations";
import { orpc } from "@/lib/orpc/orpc";

const PAGE_SIZE = 100;

export const Route = createFileRoute("/app/hub/behaviour")({
	loader: async ({ context: { queryClient } }) => {
		await Promise.all([
			queryClient.ensureQueryData(
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
			),
			queryClient.ensureQueryData(
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
			),
			queryClient.ensureQueryData(
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
			),
			queryClient.ensureQueryData(
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
	const navigate = useNavigate();
	const { mutate: deleteBlocks } = useDeleteBlocksMutation();

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
						Behaviour blocks currently available for bot usage.
					</SectionDescription>
					<SectionAction>
						<Link
							to="/app/hub/blocks/add"
							className={buttonVariants({
								size: "sm",
							})}
						>
							<PlusIcon />
							Add Behaviour
						</Link>
					</SectionAction>
				</SectionHeader>
				<SectionContent>
					{publishedBehaviourBlocks.length === 0 ? (
						<Placeholder
							Icon={BrainCircuitIcon}
							title="No published behaviour yet"
							description="Create and publish a behaviour block to make it available for bots."
							actions={[
								{
									key: "add",
									label: "Add Behaviour",
									icon: PlusIcon,
									variant: "default",
									linkProps: {
										to: "/app/hub/blocks/add",
									},
								},
							]}
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
								<BlockCard
									key={block.id}
									block={block}
									actions={{
										dropdown: [
											{
												key: "edit",
												label: "Edit Draft",
												icon: EditIcon,
												onClick: () =>
													navigate({
														to: "/app/hub/blocks/$blockId/edit",
														params: {
															blockId: block.id,
														},
													}),
											},
											{
												key: "delete",
												label: "Delete Draft",
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
										],
										footer: [],
									}}
								/>
							))}
						</SectionGrid>
					</SectionContent>
				</Section>
			)}
		</div>
	);
}
