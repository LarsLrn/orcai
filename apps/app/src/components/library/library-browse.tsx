import type { LibraryScope, LibrarySort } from "@orcai/schema";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import { LayoutGridIcon, LibraryIcon, UserIcon } from "lucide-react";
import {
	BrowseShell,
	type BrowseView,
	useBrowseSearchChange,
	useBrowseView,
} from "@/components/browse/browse-shell";
import { LibraryNewMenu } from "@/components/library/library-new-menu";
import { DataTableSearch } from "@/components/ui/data-table/data-table-search";
import {
	PageDescription,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import type { FilterValues } from "@/lib/browse/browse-search";
import { RESOURCE_KINDS } from "@/lib/labels/resource-kind";
import {
	type LibraryView,
	libraryFilters,
	librarySearchSchema,
} from "@/lib/library/library-filters";
import { libraryCountsQuery } from "@/lib/library/library-queries";
import { m } from "@/paraglide/messages";

/** The library's list views; every other library route is a detail or form. */
export const LIBRARY_VIEWS = [
	{
		view: "overview",
		routeId: "/app/library/",
		link: {
			to: "/app/library",
		},
		label: m.library_view_overview,
		Icon: LayoutGridIcon,
		tone: "text-primary",
	},
	{
		view: "bot",
		routeId: "/app/library/bots/",
		link: {
			to: "/app/library/bots",
		},
		label: m.library_view_bot,
		Icon: RESOURCE_KINDS.bot.Icon,
		tone: RESOURCE_KINDS.bot.tone,
	},
	{
		view: "behaviour",
		routeId: "/app/library/$kind/",
		link: {
			to: "/app/library/$kind",
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
		routeId: "/app/library/$kind/",
		link: {
			to: "/app/library/$kind",
			params: {
				kind: "repository",
			},
		},
		label: m.library_view_repository,
		Icon: RESOURCE_KINDS.repository.Icon,
		tone: RESOURCE_KINDS.repository.tone,
	},
	{
		view: "asset",
		routeId: "/app/library/assets/",
		link: {
			to: "/app/library/assets",
		},
		label: m.library_view_asset,
		Icon: RESOURCE_KINDS.asset.Icon,
		tone: RESOURCE_KINDS.asset.tone,
	},
] as const satisfies BrowseView<LibraryView>[];

/** The list view the current location shows, if any. */
export const useLibraryView = () => useBrowseView(LIBRARY_VIEWS);

/** The current view's search params, and changes to them that start over on the first page. */
export const useLibrarySearch = <V extends LibraryView>(view: V) => {
	const update = useBrowseSearchChange();
	const search = librarySearchSchema(libraryFilters[view]).parse(
		useSearch({
			strict: false,
		}),
	);
	return {
		search,
		// A filter or Mine leaves an activity run's assets for the whole view.
		setFilter: (key: string, value: string | string[] | boolean) =>
			update({
				[key]: value,
				run: undefined,
			}),
		setScope: (scope: LibraryScope) =>
			update({
				scope,
				run: undefined,
			}),
		setSort: (sort: LibrarySort) =>
			update({
				sort,
			}),
	};
};

/** All or Mine, kept across the views. */
const ScopeSwitch = ({
	scope,
	onScope,
}: {
	scope: LibraryScope;
	onScope: (scope: LibraryScope) => void;
}) => (
	<Tabs value={scope} onValueChange={(value) => onScope(value as LibraryScope)}>
		<TabsList
			activateOnFocus
			aria-label={m.library_scope_label()}
			className="grid w-full grid-cols-2"
		>
			{(
				[
					[
						"all",
						m.library_scope_all(),
						LibraryIcon,
					],
					[
						"edit",
						m.library_scope_mine(),
						UserIcon,
					],
				] as const
			).map(([value, label, Icon]) => (
				<TabsTrigger key={value} value={value}>
					<Icon aria-hidden="true" className="size-3.5" />
					{label}
				</TabsTrigger>
			))}
		</TabsList>
	</Tabs>
);

/** The page title with the active organisation's name in the line under it. */
const LibraryHeader = () => {
	const { data: organization } = useActiveOrganization();

	return (
		<PageHeader className="md:grid-cols-[1fr_auto] md:items-end">
			<div className="flex flex-col gap-1">
				<PageTitle>{m.library_page_title()}</PageTitle>
				{organization ? (
					<PageDescription className="md:text-sm">
						{m.library_page_description({
							organization: organization.data.name,
						})}
					</PageDescription>
				) : null}
			</div>
			<div className="flex w-full items-center gap-2 md:w-auto">
				<DataTableSearch
					placeholder={m.library_search_placeholder()}
					className="w-full md:w-80"
				/>
				<LibraryNewMenu />
			</div>
		</PageHeader>
	);
};

/** The library around a list view: header with search and New, All | Mine and the views with their counts. */
export const LibraryBrowse = ({
	view,
	children,
}: {
	view: LibraryView;
	children: React.ReactNode;
}) => {
	const { search, setFilter, setScope } = useLibrarySearch(view);
	const { data: counts } = useQuery({
		...libraryCountsQuery(search),
		placeholderData: keepPreviousData,
		select: ({ data }) =>
			Object.fromEntries(
				Object.entries(data).map(([kind, { total }]) => [
					kind,
					total,
				]),
			),
	});
	const filters = libraryFilters[view];
	const scope = <ScopeSwitch scope={search.scope} onScope={setScope} />;

	return (
		<BrowseShell
			header={<LibraryHeader />}
			views={LIBRARY_VIEWS}
			view={view}
			counts={counts ?? {}}
			navLabel={m.library_views_label()}
			controls={scope}
			filters={filters}
			values={search as FilterValues<typeof filters>}
			onFilter={setFilter}
			showFilters={view !== "overview" || search.query !== ""}
		>
			{children}
		</BrowseShell>
	);
};
