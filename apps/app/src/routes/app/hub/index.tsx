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
	SectionGrid,
	SectionHeader,
	SectionTitle,
} from "@/components/ui/shell/section";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

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
			queryClient.query(
				orpc.bot.list.queryOptions({
					input: PREVIEW_INPUT,
					staleTime: "static",
				}),
			),
			queryClient.query(
				orpc.block.list.queryOptions({
					input: {
						...BLOCKS_PREVIEW_INPUT,
						filters: {
							type: "template",
						},
					},
					staleTime: "static",
				}),
			),
			queryClient.query(
				orpc.block.list.queryOptions({
					input: {
						...BLOCKS_PREVIEW_INPUT,
						filters: {
							type: "database",
						},
					},
					staleTime: "static",
				}),
			),
			queryClient.query(
				orpc.asset.list.queryOptions({
					input: PREVIEW_INPUT,
					staleTime: "static",
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
						<SectionTitle>{m.hub_bots_section_title()}</SectionTitle>
						<SectionAction>
							<Link
								to="/app/hub/bots"
								className={buttonVariants({
									variant: "outline",
									size: "sm",
								})}
							>
								{m.hub_section_view_all_action()}
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
						<SectionTitle>{m.hub_behaviour_section_title()}</SectionTitle>
						<SectionAction>
							<Link
								to="/app/hub/behaviour"
								className={buttonVariants({
									variant: "outline",
									size: "sm",
								})}
							>
								{m.hub_section_view_all_action()}
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
						<SectionTitle>{m.hub_repositories_section_title()}</SectionTitle>
						<SectionAction>
							<Link
								to="/app/hub/repositories"
								className={buttonVariants({
									variant: "outline",
									size: "sm",
								})}
							>
								{m.hub_section_view_all_action()}
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
						<SectionTitle>{m.hub_assets_section_title()}</SectionTitle>
						<SectionAction>
							<Link
								to="/app/hub/assets"
								className={buttonVariants({
									variant: "outline",
									size: "sm",
								})}
							>
								{m.hub_section_view_all_action()}
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
