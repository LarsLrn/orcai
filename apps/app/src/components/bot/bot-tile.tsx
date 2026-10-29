import type { BotWithCapabilities } from "@orcai/schema";
import type { LinkProps } from "@tanstack/react-router";
import { EditIcon, KeyRoundIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { AccessDialog } from "@/components/access/access-dialog";
import { BotFavouriteToggle } from "@/components/bot/bot-favourites";
import { FeatureBadges } from "@/components/features/feature-badges";
import { Badge } from "@/components/ui/badge";
import type { HeaderAction } from "@/components/ui/shell/actions";
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
import { useDeleteBotsMutation } from "@/hooks/mutations/use-bot-mutations";
import { hasCapability } from "@/lib/authz/capabilities";
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

const { Icon, well, band } = RESOURCE_KINDS.bot;

/** The `…` menu of a bot tile, as far as the bot's capabilities allow. */
const botTileActions = (
	bot: Pick<TileBot, "id" | "capabilities">,
	{
		onAccess,
		onDelete,
	}: {
		onAccess: () => void;
		onDelete: () => void;
	},
): (HeaderAction | false)[] => [
	hasCapability(bot.capabilities, "edit") && {
		key: "edit",
		label: m.bots_tile_edit_action(),
		icon: EditIcon,
		linkProps: {
			to: "/app/hub/bots/$botId/setup",
			params: {
				botId: bot.id,
			},
		},
	},
	hasCapability(bot.capabilities, "manage_access") && {
		key: "access",
		label: m.bots_tile_access_action(),
		icon: KeyRoundIcon,
		onClick: onAccess,
	},
	hasCapability(bot.capabilities, "delete") && {
		key: "delete",
		label: m.bots_tile_delete_action(),
		icon: Trash2Icon,
		destructive: true,
		onClick: onDelete,
	},
];

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
	const [isAccessOpen, setIsAccessOpen] = useState(false);
	const { mutate: deleteBots } = useDeleteBotsMutation(
		{},
		{
			names: [
				bot.name,
			],
		},
	);
	const draft = bot.status === "draft";

	return (
		<Tile>
			<TileBand className={cn(band, draft && "opacity-45 grayscale")}>
				<Icon />
			</TileBand>
			<BotTileContent bot={bot} linkProps={linkProps} />
			<TileMenu
				actions={botTileActions(bot, {
					onAccess: () => setIsAccessOpen(true),
					onDelete: () =>
						deleteBots({
							refs: [
								{
									id: bot.id,
								},
							],
						}),
				})}
			>
				{draft ? null : <BotFavouriteToggle bot={bot} />}
			</TileMenu>
			{hasCapability(bot.capabilities, "manage_access") ? (
				<AccessDialog
					open={isAccessOpen}
					onOpenChange={setIsAccessOpen}
					resourceRef={{
						type: "bot",
						id: bot.id,
					}}
					resourceName={bot.name}
				/>
			) : null}
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

export { BotTile, botTileActions, CompactBotTile };
