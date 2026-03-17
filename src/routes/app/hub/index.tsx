import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BlockCard } from "@/components/blocks/block-card";
import { BotCard } from "@/components/bot/bot-card";
import { AssetCard } from "@/components/documents/asset-card";
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
import { orpc } from "@/lib/orpc/orpc";

const PREVIEW_INPUT = {
	pageIndex: 0,
	pageSize: 6,
} as const;
const BLOCKS_PREVIEW_INPUT = {
	pageIndex: 0,
	pageSize: 3,
} as const;
const NO_FOOTER: {
	footer: [];
} = {
	footer: [],
};

export const Route = createFileRoute("/app/hub/")({
	loader: async ({ context: { queryClient } }) => {
		await Promise.all([
			queryClient.ensureQueryData(
				orpc.bot.list.queryOptions({
					input: PREVIEW_INPUT,
				}),
			),
			queryClient.ensureQueryData(
				orpc.block.list.queryOptions({
					input: {
						...BLOCKS_PREVIEW_INPUT,
						filters: {
							type: "template",
						},
					},
				}),
			),
			queryClient.ensureQueryData(
				orpc.block.list.queryOptions({
					input: {
						...BLOCKS_PREVIEW_INPUT,
						filters: {
							type: "database",
						},
					},
				}),
			),
			queryClient.ensureQueryData(
				orpc.asset.list.queryOptions({
					input: PREVIEW_INPUT,
				}),
			),
		]);
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { data: bots } = useSuspenseQuery(
		orpc.bot.list.queryOptions({
			input: PREVIEW_INPUT,
		}),
	);
	const { data: behaviourBlocks } = useSuspenseQuery(
		orpc.block.list.queryOptions({
			input: {
				...BLOCKS_PREVIEW_INPUT,
				filters: {
					type: "template",
				},
			},
		}),
	);
	const { data: knowledgeBlocks } = useSuspenseQuery(
		orpc.block.list.queryOptions({
			input: {
				...BLOCKS_PREVIEW_INPUT,
				filters: {
					type: "database",
				},
			},
		}),
	);
	const { data: assets } = useSuspenseQuery(
		orpc.asset.list.queryOptions({
			input: PREVIEW_INPUT,
		}),
	);

	return (
		<div className="space-y-14">
			{bots.data.length > 0 && (
				<Section>
					<SectionHeader>
						<SectionTitle>Bots</SectionTitle>
						<SectionDescription>
							Configured AI experiences for your workspace.
						</SectionDescription>
						<SectionAction>
							<Link
								to="/app/hub/bots"
								className={buttonVariants({
									variant: "outline",
									size: "sm",
								})}
							>
								View all
							</Link>
						</SectionAction>
					</SectionHeader>
					<SectionContent>
						<SectionGrid layout="3">
							{bots.data.map((bot) => (
								<BotCard key={bot.id} bot={bot} actions={NO_FOOTER} />
							))}
						</SectionGrid>
					</SectionContent>
				</Section>
			)}

			{behaviourBlocks.data.length > 0 && (
				<Section>
					<SectionHeader>
						<SectionTitle>Behaviour</SectionTitle>
						<SectionDescription>
							System prompt and model definitions that shape bot personalities.
						</SectionDescription>
						<SectionAction>
							<Link
								to="/app/hub/blocks"
								className={buttonVariants({
									variant: "outline",
									size: "sm",
								})}
							>
								View all blocks
							</Link>
						</SectionAction>
					</SectionHeader>
					<SectionContent>
						<SectionGrid layout="3">
							{behaviourBlocks.data.map((block) => (
								<BlockCard key={block.id} block={block} actions={NO_FOOTER} />
							))}
						</SectionGrid>
					</SectionContent>
				</Section>
			)}

			{knowledgeBlocks.data.length > 0 && (
				<Section>
					<SectionHeader>
						<SectionTitle>Repositories</SectionTitle>
						<SectionDescription>
							Retrieval databases that ground bot answers in specific content.
						</SectionDescription>
						<SectionAction>
							<Link
								to="/app/hub/blocks"
								className={buttonVariants({
									variant: "outline",
									size: "sm",
								})}
							>
								View all blocks
							</Link>
						</SectionAction>
					</SectionHeader>
					<SectionContent>
						<SectionGrid layout="3">
							{knowledgeBlocks.data.map((block) => (
								<BlockCard key={block.id} block={block} actions={NO_FOOTER} />
							))}
						</SectionGrid>
					</SectionContent>
				</Section>
			)}

			{assets.data.length > 0 && (
				<Section>
					<SectionHeader>
						<SectionTitle>Content Library</SectionTitle>
						<SectionDescription>
							Reusable source material for search, retrieval, and citations.
						</SectionDescription>
						<SectionAction>
							<Link
								to="/app/hub/assets"
								className={buttonVariants({
									variant: "outline",
									size: "sm",
								})}
							>
								View all
							</Link>
						</SectionAction>
					</SectionHeader>
					<SectionContent>
						<SectionGrid layout="3">
							{assets.data.map((asset) => (
								<AssetCard key={asset.id} asset={asset} actions={NO_FOOTER} />
							))}
						</SectionGrid>
					</SectionContent>
				</Section>
			)}
		</div>
	);
}
