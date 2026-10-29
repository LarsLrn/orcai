import { Link, type LinkProps } from "@tanstack/react-router";
import { ChevronRightIcon, type LucideIcon, SearchXIcon } from "lucide-react";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

/** The rail beside the results from `lg`; below it, everything stacks. */
const BrowseLayout = ({ className, ...props }: React.ComponentProps<"div">) => (
	<div
		className={cn("grid gap-8 lg:grid-cols-[14rem_minmax(0,1fr)]", className)}
		{...props}
	/>
);

const BrowseRail = ({ className, ...props }: React.ComponentProps<"aside">) => (
	<aside
		className={cn(
			"hidden flex-col gap-6 lg:sticky lg:top-20 lg:flex lg:self-start",
			className,
		)}
		{...props}
	/>
);

const BrowseMain = ({ className, ...props }: React.ComponentProps<"div">) => (
	<div className={cn("flex min-w-0 flex-col gap-5", className)} {...props} />
);

export type BrowseNavItem = {
	key: string;
	label: string;
	Icon: LucideIcon;
	iconClassName?: string;
	count?: number;
	active: boolean;
	linkProps: LinkProps;
};

/**
 * The views of a surface: a list in the rail, a row of chips below `lg`. The
 * chip row scrolls sideways inside an inset that keeps focus rings whole.
 */
const BrowseNav = ({
	items,
	label,
	orientation,
}: {
	items: readonly BrowseNavItem[];
	label: string;
	orientation: "vertical" | "horizontal";
}) => (
	<nav
		aria-label={label}
		className={cn(
			"flex gap-1",
			orientation === "vertical"
				? "flex-col"
				: "-mx-2 -my-1 overflow-x-auto px-2 py-1 md:-mx-3 md:px-3 lg:hidden",
		)}
	>
		{items.map((item) => (
			<Link
				key={item.key}
				{...item.linkProps}
				aria-current={item.active ? "page" : undefined}
				className={cn(
					"flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/75",
					item.active && "bg-muted font-medium",
					orientation === "horizontal" && "rounded-full border",
				)}
			>
				<item.Icon
					aria-hidden="true"
					className={cn("size-4", item.iconClassName)}
				/>
				<span className="flex-1">{item.label}</span>
				{item.count === undefined ? null : (
					<span className="text-muted-foreground text-xs tabular-nums">
						{item.count}
					</span>
				)}
			</Link>
		))}
	</nav>
);

/** The heading over results: the view's name, its count and the view's controls. */
const BrowseResultsHeader = ({
	title,
	count,
	children,
}: {
	title: string;
	count: number;
	children?: React.ReactNode;
}) => (
	<div className="flex flex-wrap items-center justify-between gap-3">
		<h2 className="font-heading font-semibold text-xl tracking-tight">
			{title}{" "}
			<span className="font-normal text-muted-foreground tabular-nums">
				{count}
			</span>
		</h2>
		<div className="flex flex-wrap items-center gap-2">{children}</div>
	</div>
);

const TileGrid = ({ className, ...props }: React.ComponentProps<"div">) => (
	<div
		className={cn(
			"grid grid-cols-[repeat(auto-fill,minmax(min(100%,15rem),1fr))] gap-5",
			className,
		)}
		{...props}
	/>
);

/**
 * A titled row of tiles that scrolls sideways. Its padding, offset by
 * negative margins, leaves room for the focus ring, the hover lift and the
 * hover shadow, and insets the first and last tile from the screen edge.
 */
const Shelf = ({
	title,
	seeAll,
	restorationId,
	children,
}: {
	title: string;
	seeAll?: LinkProps;
	/** Keeps the shelf's scroll position across back and forward. */
	restorationId: string;
	children: React.ReactNode;
}) => (
	<section className="flex flex-col gap-1">
		<div className="flex items-center justify-between gap-3">
			<h2 className="font-heading font-semibold text-foreground/80 text-xl tracking-tight">
				{title}
			</h2>
			{seeAll ? (
				<Link
					{...seeAll}
					className="flex shrink-0 items-center gap-0.5 rounded-full px-2 py-1 font-medium text-primary text-sm outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/75"
				>
					{m.browse_see_all_action()}
					<ChevronRightIcon aria-hidden="true" className="size-4" />
				</Link>
			) : null}
		</div>
		<ul
			data-scroll-restoration-id={restorationId}
			className="-mx-2 -mb-6 flex snap-x scroll-px-2 gap-4 overflow-x-auto px-2 pt-3 pb-10 md:-mx-3 md:scroll-px-3 md:px-3"
		>
			{children}
		</ul>
	</section>
);

const ShelfItem = ({ className, ...props }: React.ComponentProps<"li">) => (
	<li
		className={cn("w-64 shrink-0 snap-start self-stretch", className)}
		{...props}
	/>
);

/** A search or filter that matches nothing. */
const NoResults = () => (
	<Empty className="border border-dashed">
		<EmptyHeader>
			<EmptyMedia variant="icon">
				<SearchXIcon />
			</EmptyMedia>
			<EmptyTitle>{m.browse_no_results_title()}</EmptyTitle>
			<EmptyDescription>{m.browse_no_results_description()}</EmptyDescription>
		</EmptyHeader>
	</Empty>
);

export {
	BrowseLayout,
	BrowseMain,
	BrowseNav,
	BrowseRail,
	BrowseResultsHeader,
	NoResults,
	Shelf,
	ShelfItem,
	TileGrid,
};
