import type { CatalogueKind, LibrarySort } from "@orcai/schema";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
	Link,
	type LinkProps,
	useMatches,
	useNavigate,
	useSearch,
} from "@tanstack/react-router";
import { ArrowRightIcon, CompassIcon } from "lucide-react";
import { FilterFields } from "@/components/browse/browse-filters";
import {
	BrowseLayout,
	BrowseMain,
	BrowseNav,
	type BrowseNavItem,
	BrowseRail,
} from "@/components/browse/browse-layout";
import { BrowseResults } from "@/components/browse/browse-results";
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
	catalogueCountsInput,
	catalogueFilters,
	catalogueSearchSchemas,
} from "@/lib/catalogue/catalogue-filters";
import { cataloguePaths } from "@/lib/navigation/catalogue-paths";
import { orpc } from "@/lib/orpc/orpc";
import { RESOURCE_KINDS } from "@/lib/presentation/resource-kind";
import { m } from "@/paraglide/messages";

/** The catalogue's list views; every other catalogue route is an entry's page or its wizard. */
export const CATALOGUE_VIEWS = [
	{
		view: "overview",
		routeId: "/app/catalogue/",
		to: "/app/catalogue",
		label: m.catalogue_view_discover,
		Icon: CompassIcon,
		tone: "text-primary",
	},
	{
		view: "bot",
		routeId: "/app/catalogue/bots/",
		to: "/app/catalogue/bots",
		label: m.library_view_bot,
		Icon: RESOURCE_KINDS.bot.Icon,
		tone: "text-kind-bot",
	},
	{
		view: "behaviour",
		routeId: "/app/catalogue/behaviours/",
		to: "/app/catalogue/behaviours",
		label: m.library_view_behaviour,
		Icon: RESOURCE_KINDS.behaviour.Icon,
		tone: "text-kind-behaviour",
	},
	{
		view: "repository",
		routeId: "/app/catalogue/repositories/",
		to: "/app/catalogue/repositories",
		label: m.library_view_repository,
		Icon: RESOURCE_KINDS.repository.Icon,
		tone: "text-kind-repository",
	},
] as const;

/** The list view the current location shows, if any. */
export const useCatalogueView = () => {
	const routeId = useMatches({
		select: (matches) => matches.at(-1)?.routeId,
	});
	return CATALOGUE_VIEWS.find((candidate) => candidate.routeId === routeId)
		?.view;
};

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
			to: cataloguePaths(kind).list,
		};
	const view = CATALOGUE_VIEWS.find((item) => item.view === origin.view);
	return {
		to: view?.to ?? cataloguePaths(kind).list,
		search: catalogueSearchSchemas[origin.view].parse(origin.search),
	};
};

/** The organisations with entries, whatever the search: the header's line and the filter's choices. */
const useCatalogueOrganizations = () => {
	const { data } = useQuery(
		orpc.catalogue.counts.queryOptions({
			input: catalogueCountsInput({
				query: "",
			}),
		}),
	);
	return data?.data.organizations;
};

/** The current view's filters, search params, and changes to them that start over on the first page. */
const useCatalogueSearch = (view: CatalogueView) => {
	const navigate = useNavigate();
	const filters = catalogueFilters(useCatalogueOrganizations())[view];
	const search = catalogueSearchSchemas[view].parse(
		useSearch({
			strict: false,
		}),
	) as CatalogueSearch<CatalogueView> & FilterValues<typeof filters>;
	const update = (patch: Record<string, unknown>) =>
		void navigate({
			to: ".",
			search: (previous) => ({
				...previous,
				...patch,
				pageIndex: 0,
			}),
		});
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
		<ul className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-sm">
			{picked.map((organization) => (
				<li key={organization.id}>
					<Link
						to="/app/organizations/$organizationId"
						params={{
							organizationId: organization.id,
						}}
						className="group/org flex items-center gap-1.5 rounded-sm outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/75"
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

/**
 * The catalogue's browsing shell around a list view: header with search, the
 * rail with the views, their counts and the view's filters; below `lg` the
 * views as chips above the results.
 */
export const CatalogueBrowse = ({
	view,
	children,
}: {
	view: CatalogueView;
	children: React.ReactNode;
}) => {
	const { filters, search, setFilter } = useCatalogueSearch(view);
	const { data: counts } = useQuery({
		...orpc.catalogue.counts.queryOptions({
			input: catalogueCountsInput(search),
		}),
		placeholderData: keepPreviousData,
	});
	const items: BrowseNavItem[] = CATALOGUE_VIEWS.map((item) => ({
		key: item.view,
		label: item.label(),
		Icon: item.Icon,
		iconClassName: item.tone,
		count:
			item.view === "overview" ? undefined : counts?.data.counts[item.view],
		active: item.view === view,
		linkProps: {
			to: item.to,
		},
	}));
	const showFilters = view !== "overview" || search.query !== "";

	return (
		<div className="flex flex-col gap-6">
			<CatalogueHeader />
			<BrowseLayout>
				<BrowseRail>
					<BrowseNav
						items={items}
						label={m.catalogue_views_label()}
						orientation="vertical"
					/>
					{showFilters ? (
						<FilterFields
							filters={filters}
							values={search}
							onChange={setFilter}
						/>
					) : null}
				</BrowseRail>
				<BrowseMain>
					<BrowseNav
						items={items}
						label={m.catalogue_views_label()}
						orientation="horizontal"
					/>
					{showFilters ? (
						<PickedOrganizations organizationIds={search.organizationIds} />
					) : null}
					{children}
				</BrowseMain>
			</BrowseLayout>
		</div>
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
