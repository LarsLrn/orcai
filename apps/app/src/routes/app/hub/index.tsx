import type { OrganizationCapability } from "@orcai/schema";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { LibraryIcon, PlusIcon } from "lucide-react";
import { BlockTile } from "@/components/blocks/block-tile";
import { BotTile } from "@/components/bot/bot-tile";
import { AssetTile } from "@/components/documents/asset-tile";
import { Placeholder } from "@/components/placeholders/placeholder";
import { buttonVariants } from "@/components/ui/button";
import type { Action } from "@/components/ui/shell/actions";
import {
	Section,
	SectionAction,
	SectionContent,
	SectionGrid,
	SectionHeader,
	SectionTitle,
} from "@/components/ui/shell/section";
import {
	filterByCapabilities,
	useOrganizationCapabilities,
} from "@/hooks/authz/use-capabilities";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

const PREVIEW_INPUT = {
	pageIndex: 0,
	pageSize: 6,
} as const;
const ASSETS_PREVIEW_INPUT = {
	...PREVIEW_INPUT,
	filters: {
		origin: "library",
	},
} as const;
const BLOCKS_PREVIEW_INPUT = {
	pageIndex: 0,
	pageSize: 3,
} as const;

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
					input: ASSETS_PREVIEW_INPUT,
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
			input: ASSETS_PREVIEW_INPUT,
		}),
	);
	const { data: organizationCapabilities } = useOrganizationCapabilities([
		"create_bot",
		"create_asset",
	]);

	if (
		bots.data.length === 0 &&
		behaviourBlocks.data.length === 0 &&
		knowledgeBlocks.data.length === 0 &&
		assets.data.length === 0
	) {
		const actions: (Action & {
			requires: OrganizationCapability;
		})[] = [
			{
				key: "create_bot",
				requires: "create_bot",
				label: m.bots_list_create_action(),
				icon: PlusIcon,
				variant: "default",
				linkProps: {
					to: "/app/hub/bots/add",
				},
			},
			{
				key: "add_asset",
				requires: "create_asset",
				label: m.assets_list_add_action(),
				icon: PlusIcon,
				linkProps: {
					to: "/app/hub/assets/add",
				},
			},
		];

		return (
			<Placeholder
				Icon={LibraryIcon}
				title={m.hub_all_empty_title()}
				description={m.hub_all_empty_description()}
				actions={filterByCapabilities(
					actions,
					organizationCapabilities?.data.capabilities,
					(action) => action.requires,
				)}
			/>
		);
	}

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
								<BotTile key={bot.id} bot={bot} />
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
								<BlockTile key={block.id} block={block} />
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
								<BlockTile key={block.id} block={block} />
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
								<AssetTile key={asset.id} asset={asset} />
							))}
						</SectionGrid>
					</SectionContent>
				</Section>
			)}
		</div>
	);
}
