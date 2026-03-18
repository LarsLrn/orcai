import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	BlocksIcon,
	BrainCircuitIcon,
	DatabaseIcon,
	EditIcon,
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
import { useDeleteBlocksMutation } from "@/hooks/mutations/use-block-mutations";
import { orpc } from "@/lib/orpc/orpc";

const PAGE_SIZE = 100;

export const Route = createFileRoute("/app/hub/blocks/")({
	loader: async ({ context: { queryClient } }) => {
		await Promise.all([
			queryClient.ensureQueryData(
				orpc.block.list.queryOptions({
					input: {
						pageIndex: 0,
						pageSize: PAGE_SIZE,
						filters: {
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
							type: "template",
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
							type: "database",
						},
					},
				}),
			),
		]);
	},
	component: RouteComponent,
});

function RouteComponent() {
	const navigate = useNavigate();
	const { data: draftBlocks } = useSuspenseQuery(
		orpc.block.list.queryOptions({
			input: {
				pageIndex: 0,
				pageSize: PAGE_SIZE,
				filters: {
					status: "draft",
				},
			},
		}),
	);
	const { data: templateBlocks } = useSuspenseQuery(
		orpc.block.list.queryOptions({
			input: {
				pageIndex: 0,
				pageSize: PAGE_SIZE,
				filters: {
					type: "template",
				},
			},
		}),
	);
	const { data: imageGenBlocks } = useSuspenseQuery(
		orpc.block.list.queryOptions({
			input: {
				pageIndex: 0,
				pageSize: PAGE_SIZE,
				filters: {
					type: "imageGeneration",
				},
			},
		}),
	);
	const { data: databaseBlocks } = useSuspenseQuery(
		orpc.block.list.queryOptions({
			input: {
				pageIndex: 0,
				pageSize: PAGE_SIZE,
				filters: {
					type: "database",
				},
			},
		}),
	);
	const { mutate: deleteBlocks } = useDeleteBlocksMutation();

	const behaviourBlocks = [
		...templateBlocks.data,
		...imageGenBlocks.data,
	];

	return (
		<div className="space-y-12">
			<Section>
				<SectionHeader>
					<SectionTitle>Behaviour</SectionTitle>
					<SectionDescription>
						System prompts, model configurations, and image-generation
						capabilities that shape how bots think and respond.
					</SectionDescription>
					<SectionAction>
						<Link
							to="/app/hub/blocks/add"
							className={buttonVariants({
								size: "sm",
							})}
						>
							<PlusIcon />
							Add Block
						</Link>
					</SectionAction>
				</SectionHeader>
				<SectionContent>
					{behaviourBlocks.length === 0 ? (
						<Placeholder
							Icon={BrainCircuitIcon}
							title="No behaviour blocks yet"
							description="Create a behaviour block to define how bots think and respond."
							actions={[
								{
									key: "add",
									label: "Add Block",
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
							{behaviourBlocks.map((block) => (
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

			<Section>
				<SectionHeader>
					<SectionTitle>Repositories</SectionTitle>
					<SectionDescription>
						Retrieval databases that ground bot answers in specific content
						collections.
					</SectionDescription>
				</SectionHeader>
				<SectionContent>
					{databaseBlocks.data.length === 0 ? (
						<Placeholder
							Icon={DatabaseIcon}
							title="No repository blocks yet"
							description="Create a repository block to give bots access to your content."
							actions={[
								{
									key: "add",
									label: "Add Block",
									icon: BlocksIcon,
									variant: "default",
									linkProps: {
										to: "/app/hub/blocks/add",
									},
								},
							]}
						/>
					) : (
						<SectionGrid layout="3">
							{databaseBlocks.data.map((block) => (
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

			{draftBlocks.data.length > 0 ? (
				<Section>
					<SectionHeader>
						<SectionTitle>Drafts</SectionTitle>
						<SectionDescription>
							Work-in-progress blocks that are not yet ready for published bot
							experiences.
						</SectionDescription>
					</SectionHeader>
					<SectionContent>
						<SectionGrid layout="3">
							{draftBlocks.data.map((block) => (
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
			) : null}
		</div>
	);
}
