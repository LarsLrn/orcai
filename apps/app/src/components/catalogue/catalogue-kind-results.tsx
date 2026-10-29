import type { CatalogueKind } from "@orcai/schema";
import { useSuspenseQuery } from "@tanstack/react-query";
import { CatalogueResults } from "@/components/catalogue/catalogue-browse";
import { CatalogueEmpty } from "@/components/catalogue/catalogue-empty";
import { CatalogueTile } from "@/components/catalogue/catalogue-tile";
import {
	type CatalogueSearch,
	catalogueListInput,
} from "@/lib/catalogue/catalogue-filters";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

const TITLES = {
	bot: {
		title: m.library_view_bot,
		empty: m.catalogue_kind_empty_bot,
	},
	behaviour: {
		title: m.library_view_behaviour,
		empty: m.catalogue_kind_empty_behaviour,
	},
	repository: {
		title: m.library_view_repository,
		empty: m.catalogue_kind_empty_repository,
	},
} satisfies Record<
	CatalogueKind,
	{
		title: () => string;
		empty: () => string;
	}
>;

/** A kind's entries in the catalogue, as its view's search params narrow them. */
export const CatalogueKindResults = ({
	kind,
	search,
}: {
	kind: CatalogueKind;
	search: CatalogueSearch<CatalogueKind>;
}) => {
	const { data: entries } = useSuspenseQuery(
		orpc.catalogue.list.queryOptions({
			input: catalogueListInput(kind, search),
		}),
	);

	return (
		<CatalogueResults
			view={kind}
			title={TITLES[kind].title()}
			rowCount={entries.rowCount}
			empty={<CatalogueEmpty title={TITLES[kind].empty()} />}
		>
			{entries.data.map((entry) => (
				<CatalogueTile key={entry.id} entry={entry} />
			))}
		</CatalogueResults>
	);
};
