import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import type { LibraryScope, LibrarySort } from "@orcai/schema";
import { keepPreviousData, skipToken, useQuery } from "@tanstack/react-query";
import { useMatches, useNavigate, useSearch } from "@tanstack/react-router";
import { LayoutGridIcon, LibraryIcon, UserIcon } from "lucide-react";
import { FilterFields } from "@/components/browse/browse-filters";
import {
	BrowseLayout,
	BrowseMain,
	BrowseNav,
	type BrowseNavItem,
	BrowseRail,
} from "@/components/browse/browse-layout";
import { LibraryNewMenu } from "@/components/library/library-new-menu";
import { DataTableSearch } from "@/components/ui/data-table/data-table-search";
import {
	PageDescription,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { useAuthenticatedRouteContext } from "@/hooks/authz/use-authenticated-route-context";
import type { FilterValues } from "@/lib/browse/browse-search";
import {
	type LibraryView,
	libraryCountsInput,
	libraryFilters,
	librarySearchSchema,
} from "@/lib/library/library-filters";
import { orpc } from "@/lib/orpc/orpc";
import { RESOURCE_KINDS } from "@/lib/presentation/resource-kind";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

/** The library's list views; every other library route is a detail or form. */
export const LIBRARY_VIEWS = [
	{
		view: "overview",
		routeId: "/app/library/",
		to: "/app/library",
		label: m.library_view_overview,
		Icon: LayoutGridIcon,
		tone: "text-primary",
	},
	{
		view: "bot",
		routeId: "/app/library/bots/",
		to: "/app/library/bots",
		label: m.library_view_bot,
		Icon: RESOURCE_KINDS.bot.Icon,
		tone: "text-kind-bot",
	},
	{
		view: "behaviour",
		routeId: "/app/library/behaviours/",
		to: "/app/library/behaviours",
		label: m.library_view_behaviour,
		Icon: RESOURCE_KINDS.behaviour.Icon,
		tone: "text-kind-behaviour",
	},
	{
		view: "repository",
		routeId: "/app/library/repositories/",
		to: "/app/library/repositories",
		label: m.library_view_repository,
		Icon: RESOURCE_KINDS.repository.Icon,
		tone: "text-kind-repository",
	},
	{
		view: "asset",
		routeId: "/app/library/assets/",
		to: "/app/library/assets",
		label: m.library_view_asset,
		Icon: RESOURCE_KINDS.asset.Icon,
		tone: "text-kind-asset",
	},
] as const;

/** The list view the current location shows, if any. */
export const useLibraryView = () => {
	const routeId = useMatches({
		select: (matches) => matches.at(-1)?.routeId,
	});
	return LIBRARY_VIEWS.find((candidate) => candidate.routeId === routeId)?.view;
};

/** The current view's search params, and changes to them that start over on the first page. */
export const useLibrarySearch = <V extends LibraryView>(view: V) => {
	const navigate = useNavigate();
	const search = librarySearchSchema(libraryFilters[view]).parse(
		useSearch({
			strict: false,
		}),
	);
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
		search,
		setFilter: (key: string, value: string | boolean) =>
			update({
				[key]: value,
			}),
		setScope: (scope: LibraryScope) =>
			update({
				scope,
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
	<RadioGroup
		value={scope}
		onValueChange={(value) => onScope(value as LibraryScope)}
		aria-label={m.library_scope_label()}
		className="grid grid-cols-2 rounded-full bg-muted p-1 text-sm"
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
			<Radio.Root
				key={value}
				value={value}
				className={cn(
					"flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/75",
					"data-checked:bg-background data-checked:font-medium data-checked:text-foreground data-checked:shadow-xs",
				)}
			>
				<Icon aria-hidden="true" className="size-3.5" />
				{label}
			</Radio.Root>
		))}
	</RadioGroup>
);

/** The page title with the active organisation's name in the line under it. */
const LibraryHeader = () => {
	const { auth } = useAuthenticatedRouteContext();
	const organizationId = auth.session.activeOrganizationId;
	const { data: organization } = useQuery(
		orpc.organization.find.queryOptions({
			input: organizationId
				? {
						id: organizationId,
					}
				: skipToken,
		}),
	);

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

/**
 * The library's browsing shell around a list view: header with search and
 * New, the rail with All | Mine, the views with their counts and the view's
 * filters; below `lg` the switch and the views as chips above the results.
 */
export const LibraryBrowse = ({
	view,
	children,
}: {
	view: LibraryView;
	children: React.ReactNode;
}) => {
	const { search, setFilter, setScope } = useLibrarySearch(view);
	const { data: counts } = useQuery({
		...orpc.library.counts.queryOptions({
			input: libraryCountsInput(search),
		}),
		placeholderData: keepPreviousData,
	});
	const items: BrowseNavItem[] = LIBRARY_VIEWS.map((item) => ({
		key: item.view,
		label: item.label(),
		Icon: item.Icon,
		iconClassName: item.tone,
		count: item.view === "overview" ? undefined : counts?.data[item.view],
		active: item.view === view,
		linkProps: {
			to: item.to,
		},
	}));
	const filters = libraryFilters[view];
	const showFilters = view !== "overview" || search.query !== "";

	return (
		<div className="flex flex-col gap-6">
			<LibraryHeader />
			<BrowseLayout>
				<BrowseRail>
					<ScopeSwitch scope={search.scope} onScope={setScope} />
					<BrowseNav
						items={items}
						label={m.library_views_label()}
						orientation="vertical"
					/>
					{showFilters ? (
						<FilterFields
							filters={filters}
							values={search as FilterValues<typeof filters>}
							onChange={setFilter}
						/>
					) : null}
				</BrowseRail>
				<BrowseMain>
					<div className="flex flex-col gap-3 lg:hidden">
						<ScopeSwitch scope={search.scope} onScope={setScope} />
						<BrowseNav
							items={items}
							label={m.library_views_label()}
							orientation="horizontal"
						/>
					</div>
					{children}
				</BrowseMain>
			</BrowseLayout>
		</div>
	);
};
