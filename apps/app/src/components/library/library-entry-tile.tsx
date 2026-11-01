import type { LibraryEntry } from "@orcai/schema";
import { AssetTile } from "@/components/assets/asset-tile";
import { BlockTile } from "@/components/blocks/block-tile";
import { BotTile } from "@/components/bot/bot-tile";

/** The tile of one item of a mixed library list. */
export const LibraryEntryTile = ({ entry }: { entry: LibraryEntry }) =>
	entry.kind === "bot" ? (
		<BotTile bot={entry.bot} />
	) : entry.kind === "block" ? (
		<BlockTile block={entry.block} />
	) : (
		<AssetTile asset={entry.asset} />
	);

export const libraryEntryId = (entry: LibraryEntry) =>
	entry.kind === "bot"
		? entry.bot.id
		: entry.kind === "block"
			? entry.block.id
			: entry.asset.id;
