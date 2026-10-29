import type { BotWithCapabilities } from "@orcai/schema";
import type { LinkProps } from "@tanstack/react-router";
import { useBotActions } from "@/components/bot/bot-actions";
import { BotFavouriteToggle } from "@/components/bot/bot-favourites";
import { FeatureBadges } from "@/components/features/feature-badges";
import { Badge } from "@/components/ui/badge";
import {
	Tile,
	TileBand,
	TileBody,
	TileDescription,
	TileFooter,
	TileIcon,
	TileMenu,
	TileTitle,
} from "@/components/ui/shell/tile";
import { getPublicationStatusLabel } from "@/lib/presentation/publication-status";
import { RESOURCE_KINDS } from "@/lib/presentation/resource-kind";
import { cn } from "@/lib/utils";

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

const { Icon, well, band } = RESOURCE_KINDS.bot;

const BotTileContent = ({
	bot,
	linkProps,
}: {
	bot: TileBot;
	linkProps: LinkProps;
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
			<TileDescription>{bot.description}</TileDescription>
			<TileFooter>
				{bot.status === "draft" ? (
					<Badge variant="outline">{getPublicationStatusLabel("draft")}</Badge>
				) : null}
				<FeatureBadges features={bot.features} className="contents" />
			</TileFooter>
		</TileBody>
	</>
);

const detailLink = (bot: Pick<TileBot, "id">): LinkProps => ({
	to: "/app/hub/bots/$botId",
	params: {
		botId: bot.id,
	},
});

/** A bot on a browsing surface: band, favourite star and its `…` menu. */
const BotTile = ({
	bot,
	linkProps = detailLink(bot),
}: {
	bot: TileBot;
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
			<BotTileContent bot={bot} linkProps={linkProps} />
			<TileMenu
				actions={[
					actions.edit,
					actions.access,
					actions.delete,
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

export { BotTile, CompactBotTile };
