import {
	Link,
	type LinkProps,
	useMatches,
	useNavigate,
} from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { FilterFields } from "@/components/browse/browse-filters";
import type {
	FilterDefinitions,
	FilterValues,
} from "@/lib/browse/browse-search";
import { cn } from "@/lib/utils";

/** A list view of a browsing surface: its route, its link and how its entry in the views looks. */
export type BrowseView<V extends string = string> = {
	view: V;
	routeId: string;
	to: LinkProps["to"];
	label: () => string;
	Icon: LucideIcon;
	tone: string;
};

/** The list view the current location shows, if any. */
export const useBrowseView = <V extends string>(
	views: readonly BrowseView<V>[],
): V | undefined => {
	const routeId = useMatches({
		select: (matches) => matches.at(-1)?.routeId,
	});
	return views.find((candidate) => candidate.routeId === routeId)?.view;
};

/** Changes the current view's search params and starts over on the first page. */
export const useBrowseSearchChange = () => {
	const navigate = useNavigate();
	return (patch: Record<string, unknown>) =>
		void navigate({
			to: ".",
			search: (previous) => ({
				...previous,
				...patch,
				pageIndex: 0,
			}),
		});
};

/**
 * The views of a surface: a list in the rail, a row of chips below `lg`. The
 * chip row scrolls sideways inside an inset that keeps focus rings whole.
 */
const BrowseNav = <V extends string>({
	views,
	active,
	counts,
	label,
	orientation,
}: {
	views: readonly BrowseView<V>[];
	active: V;
	counts: Partial<Record<V, number>>;
	label: string;
	orientation: "vertical" | "horizontal";
}) => (
	<nav
		aria-label={label}
		className={cn(
			"flex gap-1",
			orientation === "vertical"
				? "flex-col"
				: "-mx-2 -my-1 overflow-x-auto px-2 py-1 md:-mx-3 md:px-3",
		)}
	>
		{views.map((item) => {
			const count = counts[item.view];
			return (
				<Link
					key={item.view}
					to={item.to}
					aria-current={item.view === active ? "page" : undefined}
					className={cn(
						"hover:bg-muted focus-visible:ring-ring/75 flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors outline-none focus-visible:ring-[3px]",
						item.view === active && "bg-muted font-medium",
						orientation === "horizontal" && "rounded-full border",
					)}
				>
					<item.Icon aria-hidden="true" className={cn("size-4", item.tone)} />
					<span className="flex-1">{item.label()}</span>
					{count === undefined ? null : (
						<span className="text-muted-foreground text-xs tabular-nums">
							{count}
						</span>
					)}
				</Link>
			);
		})}
	</nav>
);

/**
 * A browsing surface around a list view: the header, then the rail with
 * `controls`, the views with their counts and the view's filters beside the
 * results from `lg`. Below it, `controls` and the views as chips sit above
 * the results.
 */
export const BrowseShell = <V extends string, D extends FilterDefinitions>({
	header,
	views,
	view,
	counts,
	navLabel,
	controls,
	filters,
	values,
	onFilter,
	showFilters,
	children,
}: {
	header: React.ReactNode;
	views: readonly BrowseView<V>[];
	view: V;
	counts: Partial<Record<V, number>>;
	navLabel: string;
	controls?: React.ReactNode;
	filters: D;
	values: FilterValues<D>;
	onFilter: (key: keyof D & string, value: string | string[] | boolean) => void;
	showFilters: boolean;
	children: React.ReactNode;
}) => {
	const nav = {
		views,
		active: view,
		counts,
		label: navLabel,
	};
	return (
		<div className="flex flex-col gap-6">
			{header}
			<div className="grid gap-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
				<aside className="hidden flex-col gap-6 lg:sticky lg:top-20 lg:flex lg:self-start">
					{controls}
					<BrowseNav {...nav} orientation="vertical" />
					{showFilters ? (
						<FilterFields
							filters={filters}
							values={values}
							onChange={onFilter}
						/>
					) : null}
				</aside>
				<div className="flex min-w-0 flex-col gap-5">
					<div className="flex flex-col gap-3 lg:hidden">
						{controls}
						<BrowseNav {...nav} orientation="horizontal" />
					</div>
					{children}
				</div>
			</div>
		</div>
	);
};
