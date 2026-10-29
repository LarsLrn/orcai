import type { CatalogueEntry } from "@orcai/schema";
import { botContentsLabel, botModelHintBadge } from "@/components/bot/bot-tile";
import { useCatalogueOrigin } from "@/components/catalogue/catalogue-browse";
import { useActiveOrganizationName } from "@/components/catalogue/installer";
import { SourceOrganizationName } from "@/components/catalogue/resource-provenance";
import {
	Tile,
	TileBadges,
	TileBand,
	TileBody,
	TileDescription,
	TileFooter,
	TileIcon,
	TileMark,
	TileProvenance,
	TileTitle,
} from "@/components/ui/shell/tile";
import { cataloguePaths } from "@/lib/navigation/catalogue-paths";
import { RESOURCE_KINDS } from "@/lib/presentation/resource-kind";
import { m } from "@/paraglide/messages";

/** What the entry holds: a bot's blocks, "Prompt", or a repository's documents. */
const catalogueContentsLabel = (
	entry: Pick<CatalogueEntry, "kind" | "contents" | "documents">,
) =>
	entry.contents
		? botContentsLabel(entry.contents)
		: entry.kind === "behaviour"
			? m.blocks_tile_behaviour_contents()
			: entry.documents
				? m.blocks_tile_documents({
						count: entry.documents,
					})
				: m.blocks_tile_no_documents();

/** An entry on a catalogue page: band, the source organisation and the "Added" mark. */
const CatalogueTile = ({ entry }: { entry: CatalogueEntry }) => {
	const { Icon, well, band } = RESOURCE_KINDS[entry.kind];
	const organisation = useActiveOrganizationName();
	const from = useCatalogueOrigin();
	const added = entry.state === "added";
	const modelHint = botModelHintBadge(entry.modelHint);

	return (
		<Tile>
			<TileBand className={band}>
				<Icon />
			</TileBand>
			<TileIcon className={well}>
				<Icon />
				{added ? <TileMark /> : null}
			</TileIcon>
			<TileBody>
				<TileTitle
					action={{
						linkProps: {
							to: cataloguePaths(entry.kind).detail,
							params: {
								id: entry.id,
							},
							search: {
								from,
							},
						},
					}}
				>
					{entry.name}
					{added ? (
						<span className="sr-only">
							{" "}
							{organisation
								? m.catalogue_tile_added_label({
										organisation,
									})
								: m.catalogue_tile_added_fallback_label()}
						</span>
					) : null}
				</TileTitle>
				<TileProvenance>
					<SourceOrganizationName organization={entry.source} />
				</TileProvenance>
				<TileDescription>{entry.description}</TileDescription>
				<TileFooter>
					<span>{catalogueContentsLabel(entry)}</span>
					<TileBadges
						badges={
							modelHint
								? [
										modelHint,
									]
								: []
						}
					/>
				</TileFooter>
			</TileBody>
		</Tile>
	);
};

export { CatalogueTile };
