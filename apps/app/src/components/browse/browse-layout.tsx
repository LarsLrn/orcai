import { Link, type LinkProps } from "@tanstack/react-router";
import { ChevronRightIcon, SearchXIcon } from "lucide-react";
import { Placeholder } from "@/components/placeholders/placeholder";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

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
		<h2 className="font-heading text-xl font-semibold tracking-tight">
			{title}{" "}
			<span className="text-muted-foreground font-normal tabular-nums">
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
			<h2 className="font-heading text-foreground/80 text-xl font-semibold tracking-tight">
				{title}
			</h2>
			{seeAll ? (
				<Link
					{...seeAll}
					className="text-primary hover:bg-muted focus-visible:ring-ring/75 flex shrink-0 items-center gap-0.5 rounded-full px-2 py-1 text-sm font-medium outline-none focus-visible:ring-[3px]"
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
	<Placeholder
		className="border"
		Icon={SearchXIcon}
		title={m.browse_no_results_title()}
		description={m.browse_no_results_description()}
	/>
);

export { BrowseResultsHeader, NoResults, Shelf, ShelfItem, TileGrid };
