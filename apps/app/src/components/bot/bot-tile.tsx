import type { BotListItem, BotWithCapabilities } from "@orcai/schema";
import type { LinkProps } from "@tanstack/react-router";
import { useBotActions } from "@/components/bot/bot-actions";
import { BotFavouriteToggle } from "@/components/bot/bot-favourites";
import { ResourceProvenance } from "@/components/catalogue/resource-provenance";
import { FeatureBadges } from "@/components/features/feature-badges";
import { Badge } from "@/components/ui/badge";
import {
	Tile,
	TileBadges,
	TileBand,
	TileBody,
	TileDescription,
	TileFooter,
	TileIcon,
	TileMenu,
	TileProvenance,
	TileTitle,
} from "@/components/ui/shell/tile";
import type { BadgeItem } from "@/lib/presentation/badge-item";
import { getPublicationStatusLabel } from "@/lib/presentation/publication-status";
import { RESOURCE_KINDS } from "@/lib/presentation/resource-kind";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

type TileBot = Pick<
	BotWithCapabilities,
	| "id"
	| "name"
	| "description"
	| "status"
	| "features"
	| "capabilities"
	| "isFavourite"
>;

/** A bot as library lists return it, with its tile details. */
type BrowseBot = TileBot &
	Pick<BotListItem, "owner" | "contents" | "modelHint" | "homeOrganization">;

const { Icon, well, band } = RESOURCE_KINDS.bot;

/** What the bot is made of: "Behaviour + 2 repositories", or "Model only". */
const botContentsLabel = ({
	behaviour,
	repositories,
}: BotListItem["contents"]) => {
	const parts = [
		behaviour ? m.bots_tile_contents_behaviour() : null,
		repositories > 0
			? m.bots_tile_contents_repositories({
					count: repositories,
				})
			: null,
	].filter((part) => part !== null);
	return parts.length > 0
		? parts.join(" + ")
		: m.bots_tile_contents_model_only();
};

/** The model the bot's setup asks for: a warning when required, a hint when recommended. */
const botModelHintBadge = (hint: BotListItem["modelHint"]): BadgeItem | null =>
	hint
		? hint.strength === "required"
			? {
					label: m.bots_tile_model_required({
						model: hint.modelName,
					}),
					variant: "warning",
				}
			: {
					label: m.bots_tile_model_tuned({
						model: hint.modelName,
					}),
					variant: "outline",
				}
		: null;

const BotTileContent = ({
	bot,
	linkProps,
	provenance,
	children,
}: {
	bot: TileBot;
	linkProps: LinkProps;
	provenance?: React.ReactNode;
	/** The footer's leading entries, before its badges. */
	children?: React.ReactNode;
}) => (
	<>
		<TileIcon className={well}>
			<Icon />
		</TileIcon>
		<TileBody>
			<TileTitle
				action={{
					linkProps,
				}}
			>
				{bot.name}
			</TileTitle>
			{provenance}
			<TileDescription>{bot.description}</TileDescription>
			<TileFooter>
				{children}
				{bot.status === "draft" ? (
					<Badge variant="outline">{getPublicationStatusLabel("draft")}</Badge>
				) : null}
				<FeatureBadges features={bot.features} className="contents" />
			</TileFooter>
		</TileBody>
	</>
);

const detailLink = (bot: Pick<TileBot, "id">): LinkProps => ({
	to: "/app/library/bots/$botId",
	params: {
		botId: bot.id,
	},
});

/** A bot on a browsing surface: band, favourite star and its `…` menu. */
const BotTile = ({
	bot,
	linkProps = detailLink(bot),
}: {
	bot: BrowseBot;
	/** Where the tile leads; the bot's page unless given. */
	linkProps?: LinkProps;
}) => {
	const { actions, dialog } = useBotActions(bot);
	const draft = bot.status === "draft";

	return (
		<Tile>
			<TileBand className={cn(band, draft && "opacity-45 grayscale")}>
				<Icon />
			</TileBand>
			<BotTileContent
				bot={bot}
				linkProps={linkProps}
				provenance={
					<TileProvenance>
						<ResourceProvenance
							owner={bot.owner}
							homeOrganization={bot.homeOrganization}
						/>
					</TileProvenance>
				}
			>
				<span>{botContentsLabel(bot.contents)}</span>
				<TileBadges
					badges={[
						botModelHintBadge(bot.modelHint),
					].filter((badge) => badge !== null)}
				/>
			</BotTileContent>
			<TileMenu
				actions={[
					actions.edit,
					actions.access,
					actions.handOver,
					actions.delete,
					actions.remove,
				]}
			>
				{draft ? null : <BotFavouriteToggle bot={bot} />}
			</TileMenu>
			{dialog}
		</Tile>
	);
};

/** A bot in context, such as a chat's settings: no band, only the favourite star. */
const CompactBotTile = ({ bot }: { bot: TileBot }) => (
	<Tile>
		<BotTileContent bot={bot} linkProps={detailLink(bot)} />
		<TileMenu actions={[]}>
			{bot.status === "draft" ? null : <BotFavouriteToggle bot={bot} />}
		</TileMenu>
	</Tile>
);

export { BotTile, botContentsLabel, botModelHintBadge, CompactBotTile };
