import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	BlocksIcon,
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

export const Route = createFileRoute("/app/hub/repositories")({
	head: () => ({
		meta: [
			{
				title: "Repositories",
			},
		],
	}),
	loader: async ({ context: { queryClient } }) => {
		await Promise.all([
			queryClient.ensureQueryData(
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
			),
			queryClient.ensureQueryData(
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
			),
		]);
	},
	component: RouteComponent,
});

function RouteComponent() {
	const navigate = useNavigate();
	const { mutate: deleteBlocks } = useDeleteBlocksMutation();

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
					<SectionTitle>Published</SectionTitle>
					<SectionDescription>
						Repository blocks currently available for bot retrieval.
					</SectionDescription>
					<SectionAction>
						<Link
							to="/app/hub/blocks/add"
							className={buttonVariants({
								size: "sm",
							})}
						>
							<PlusIcon />
							Add Repository
						</Link>
					</SectionAction>
				</SectionHeader>
				<SectionContent>
					{publishedRepositoryBlocks.length === 0 ? (
						<Placeholder
							Icon={DatabaseIcon}
							title="No published repositories yet"
							description="Create and publish a repository block to make it available for bots."
							actions={[
								{
									key: "add",
									label: "Add Repository",
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
							{publishedRepositoryBlocks.map((block) => (
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

			{draftRepositoryBlocks.length > 0 && (
				<Section>
					<SectionHeader>
						<SectionTitle>Your drafts</SectionTitle>
						<SectionDescription>
							Resume repository blocks that are not published yet.
						</SectionDescription>
					</SectionHeader>
					<SectionContent>
						<SectionGrid layout="3">
							{draftRepositoryBlocks.map((block) => (
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
