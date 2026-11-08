import type { CatalogueKind, LibrarySort } from "@orcai/schema";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, type LinkProps, useSearch } from "@tanstack/react-router";
import { ArrowRightIcon, CompassIcon } from "lucide-react";
import { BrowseResults } from "@/components/browse/browse-results";
import {
	BrowseShell,
	type BrowseView,
	useBrowseSearchChange,
	useBrowseView,
} from "@/components/browse/browse-shell";
import { OrganizationLogo } from "@/components/organizations/organization-logo";
import { DataTableSearch } from "@/components/ui/data-table/data-table-search";
import {
	PageDescription,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import type { FilterValues } from "@/lib/browse/browse-search";
import {
	type CatalogueOrigin,
	type CatalogueSearch,
	type CatalogueView,
	catalogueFilters,
	catalogueSearchSchemas,
} from "@/lib/catalogue/catalogue-filters";
import { catalogueCountsQuery } from "@/lib/catalogue/catalogue-queries";
import { RESOURCE_KINDS } from "@/lib/presentation/resource-kind";
import { m } from "@/paraglide/messages";

/** The catalogue's list views; every other catalogue route is an entry's page or its wizard. */
export const CATALOGUE_VIEWS = [
	{
		view: "overview",
		routeId: "/app/catalogue/",
		link: {
			to: "/app/catalogue",
		},
		label: m.catalogue_view_discover,
		Icon: CompassIcon,
		tone: "text-primary",
	},
	{
		view: "bot",
		routeId: "/app/catalogue/$kind/",
		link: {
			to: "/app/catalogue/$kind",
			params: {
				kind: "bot",
			},
		},
		label: m.library_view_bot,
		Icon: RESOURCE_KINDS.bot.Icon,
		tone: RESOURCE_KINDS.bot.tone,
	},
	{
		view: "behaviour",
		routeId: "/app/catalogue/$kind/",
		link: {
			to: "/app/catalogue/$kind",
			params: {
				kind: "behaviour",
			},
		},
		label: m.library_view_behaviour,
		Icon: RESOURCE_KINDS.behaviour.Icon,
		tone: RESOURCE_KINDS.behaviour.tone,
	},
	{
		view: "repository",
		routeId: "/app/catalogue/$kind/",
		link: {
			to: "/app/catalogue/$kind",
			params: {
				kind: "repository",
			},
		},
		label: m.library_view_repository,
		Icon: RESOURCE_KINDS.repository.Icon,
		tone: RESOURCE_KINDS.repository.tone,
	},
] as const satisfies BrowseView<CatalogueView>[];

/** The list view the current location shows, if any. */
export const useCatalogueView = () => useBrowseView(CATALOGUE_VIEWS);

/** The current view as an entry's origin, if a list view shows. */
export const useCatalogueOrigin = (): CatalogueOrigin | undefined => {
	const view = useCatalogueView();
	const search = useSearch({
		strict: false,
	});
	return view
		? {
				view,
				search,
			}
		: undefined;
};

/** Back to the origin with its search, paging and filters; the kind's view without one. */
export const catalogueReturnLink = (
	origin: CatalogueOrigin | undefined,
	kind: CatalogueKind,
): LinkProps => {
	if (!origin)
		return {
			to: "/app/catalogue/$kind",
			params: {
				kind,
			},
		};
	if (origin.view === "overview")
		return {
			to: "/app/catalogue",
			search: catalogueSearchSchemas.overview.parse(origin.search),
		};
	return {
		to: "/app/catalogue/$kind",
		params: {
			kind: origin.view,
		},
		search: catalogueSearchSchemas[origin.view].parse(origin.search),
	};
};

/** The organisations with entries, whatever the search: the header's line and the filter's choices. */
const useCatalogueOrganizations = () => {
	const { data } = useQuery(
		catalogueCountsQuery({
			query: "",
		}),
	);
	return data?.data.organizations;
};

/** The current view's filters, search params, and changes to them that start over on the first page. */
const useCatalogueSearch = (view: CatalogueView) => {
	const update = useBrowseSearchChange();
	const filters = catalogueFilters(useCatalogueOrganizations())[view];
	const search = catalogueSearchSchemas[view].parse(
		useSearch({
			strict: false,
		}),
	) as CatalogueSearch<CatalogueView> & FilterValues<typeof filters>;
	return {
		filters,
		search,
		setFilter: (key: string, value: string | string[] | boolean) =>
			update({
				[key]: value,
			}),
		setSort: (sort: LibrarySort) =>
			update({
				sort,
			}),
	};
};

/** Links to the pages of the organisations the Organisation filter picked. */
const PickedOrganizations = ({
	organizationIds,
}: {
	organizationIds: readonly string[];
}) => {
	const picked = (useCatalogueOrganizations() ?? []).filter((organization) =>
		organizationIds.includes(organization.id),
	);
	if (picked.length === 0) return null;
	return (
		<ul className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
			{picked.map((organization) => (
				<li key={organization.id}>
					<Link
						to="/app/organizations/$organizationId"
						params={{
							organizationId: organization.id,
						}}
						className="group/org hover:text-foreground focus-visible:ring-ring/75 flex items-center gap-1.5 rounded-sm outline-none focus-visible:ring-3"
					>
						<OrganizationLogo organization={organization} size="sm" />
						<span className="group-hover/org:underline">
							{m.catalogue_organisation_page_link({
								organisation: organization.name,
							})}
						</span>
						<ArrowRightIcon aria-hidden="true" className="size-3.5" />
					</Link>
				</li>
			))}
		</ul>
	);
};

const CatalogueHeader = () => {
	const organizations = useCatalogueOrganizations();
	return (
		<PageHeader className="md:grid-cols-[1fr_auto] md:items-end">
			<div className="flex flex-col gap-1">
				<PageTitle>{m.catalogue_page_title()}</PageTitle>
				{organizations?.length ? (
					<PageDescription className="md:text-sm">
						{m.catalogue_page_description({
							count: organizations.length,
						})}
					</PageDescription>
				) : null}
			</div>
			<DataTableSearch
				placeholder={m.catalogue_search_placeholder()}
				className="w-full md:w-80"
			/>
		</PageHeader>
	);
};

/** The catalogue around a list view: header with search, the views with their counts and links to the picked organisations. */
export const CatalogueBrowse = ({
	view,
	children,
}: {
	view: CatalogueView;
	children: React.ReactNode;
}) => {
	const { filters, search, setFilter } = useCatalogueSearch(view);
	const { data: counts } = useQuery({
		...catalogueCountsQuery(search),
		placeholderData: keepPreviousData,
	});
	const showFilters = view !== "overview" || search.query !== "";

	return (
		<BrowseShell
			header={<CatalogueHeader />}
			views={CATALOGUE_VIEWS}
			view={view}
			counts={counts?.data.counts ?? {}}
			navLabel={m.catalogue_views_label()}
			filters={filters}
			values={search}
			onFilter={setFilter}
			showFilters={showFilters}
		>
			{showFilters ? (
				<PickedOrganizations organizationIds={search.organizationIds} />
			) : null}
			{children}
		</BrowseShell>
	);
};

/** One catalogue view's results in the browse shell. */
export const CatalogueResults = ({
	view,
	...props
}: {
	view: CatalogueView;
	title: string;
	rowCount: number;
	empty: React.ReactNode;
	children: React.ReactNode;
}) => {
	const { filters, search, setFilter, setSort } = useCatalogueSearch(view);
	return (
		<BrowseResults
			filters={filters}
			search={search}
			onFilter={setFilter}
			onSort={setSort}
			{...props}
		/>
	);
};
