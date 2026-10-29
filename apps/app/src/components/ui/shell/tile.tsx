import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { Link } from "@tanstack/react-router";
import { CheckIcon } from "lucide-react";
import type * as React from "react";
import {
	ActionMenu,
	type ClickAction,
	type HeaderAction,
} from "@/components/ui/shell/actions";
import { cn } from "@/lib/utils";

/*
 * A tile with a `TileBand` is the browsing tile: band on top, the icon well
 * overlapping it, the corner cluster on the band. Without one it is the
 * compact tile: icon, body and cluster side by side. The parts read which one
 * they are in from the tile, so no part takes a layout prop.
 */

const Tile = ({ className, ...props }: React.ComponentProps<"article">) => (
	<article
		data-slot="tile"
		className={cn(
			"group/tile relative flex h-full gap-3 rounded-3xl border bg-card p-4 text-card-foreground shadow-xs transition-[translate,box-shadow,border-color] duration-200 hover:border-foreground/15 hover:shadow-md has-data-[slot=tile-band]:flex-col has-data-[slot=tile-band]:gap-0 has-data-[slot=tile-band]:p-0 has-data-[slot=tile-band]:hover:shadow-xl motion-safe:has-data-[slot=tile-band]:hover:-translate-y-1",
			"has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/75",
			"has-[[data-slot=tile-title]_[aria-pressed=true]]:border-accent-brand/60 has-[[data-slot=tile-title]_[aria-pressed=true]]:ring-2 has-[[data-slot=tile-title]_[aria-pressed=true]]:ring-accent-brand/40",
			"has-[[data-slot=tile-title]_[aria-busy=true]]:loading-ring [--loading-ring-radius:calc(var(--radius-3xl)+6px)] has-[[data-slot=tile-title]_:disabled:not([aria-busy=true])]:opacity-70",
			className,
		)}
		{...props}
	/>
);

/** The kind-tinted strip on top of a browsing tile; its child is the large faint glyph. */
const TileBand = ({ className, ...props }: React.ComponentProps<"div">) => (
	<div
		data-slot="tile-band"
		aria-hidden="true"
		className={cn(
			"relative h-24 shrink-0 overflow-hidden rounded-t-[inherit] bg-linear-to-br [&>svg]:absolute [&>svg]:-right-4 [&>svg]:-bottom-6 [&>svg]:size-32 [&>svg]:text-foreground/[0.07] [&>svg]:transition-transform motion-safe:group-hover/tile:[&>svg]:scale-110",
			className,
		)}
		{...props}
	/>
);

/** The icon well; `className` tints it. A `TileMark` child sits on its corner. */
const TileIcon = ({
	className,
	children,
	...props
}: React.ComponentProps<"div">) => (
	<div
		data-slot="tile-icon"
		className="pointer-events-none relative shrink-0 self-start group-has-data-[slot=tile-band]/tile:z-10 group-has-data-[slot=tile-band]/tile:-mt-8 group-has-data-[slot=tile-band]/tile:ml-5 group-has-data-[slot=tile-band]/tile:rounded-2xl group-has-data-[slot=tile-band]/tile:border-4 group-has-data-[slot=tile-band]/tile:border-card group-has-data-[slot=tile-band]/tile:bg-card group-has-data-[slot=tile-band]/tile:shadow-sm"
		{...props}
	>
		<div
			className={cn(
				"flex size-10 items-center justify-center rounded-xl bg-muted group-has-data-[slot=tile-band]/tile:size-12 [&>svg]:size-5 group-has-data-[slot=tile-band]/tile:[&>svg]:size-6",
				className,
			)}
		>
			{children}
		</div>
	</div>
);

/** The check on the icon well, for "Added" and "Selected"; the title carries its meaning. */
const TileMark = ({ className, ...props }: React.ComponentProps<"span">) => (
	<span
		data-slot="tile-mark"
		aria-hidden="true"
		className={cn(
			"absolute -right-1.5 -bottom-1.5 flex size-5 items-center justify-center rounded-full bg-status-success text-white ring-2 ring-card",
			className,
		)}
		{...props}
	>
		<CheckIcon className="size-3" strokeWidth={3} />
	</span>
);

const TileBody = ({ className, ...props }: React.ComponentProps<"div">) => (
	<div
		data-slot="tile-body"
		className={cn(
			"flex min-w-0 flex-1 flex-col gap-1.5 group-has-data-[slot=tile-band]/tile:gap-2 group-has-data-[slot=tile-band]/tile:px-5 group-has-data-[slot=tile-band]/tile:pt-3 group-has-data-[slot=tile-band]/tile:pb-5",
			className,
		)}
		{...props}
	/>
);

const stretchedTargetClassName =
	"rounded-sm text-left outline-none after:absolute after:inset-0 after:rounded-3xl";

/**
 * The name, and the tile's one tab stop: a link or button stretched over the
 * whole tile. `pressed` makes the button a toggle, as in pickers.
 */
const TileTitle = ({
	action,
	pressed,
	className,
	children,
}: {
	action: ClickAction;
	pressed?: boolean;
	className?: string;
	children: React.ReactNode;
}) => (
	<h3
		data-slot="tile-title"
		className={cn(
			"line-clamp-2 break-words font-heading font-semibold text-base leading-tight tracking-tight group-has-data-[slot=tile-band]/tile:text-lg",
			className,
		)}
	>
		{action.linkProps ? (
			<Link {...action.linkProps} className={stretchedTargetClassName}>
				{children}
			</Link>
		) : (
			<ButtonPrimitive
				onClick={action.onClick}
				disabled={action.disabled || action.loading}
				focusableWhenDisabled={action.loading || undefined}
				aria-busy={action.loading || undefined}
				aria-pressed={pressed}
				className={cn(
					stretchedTargetClassName,
					"disabled:cursor-not-allowed aria-busy:cursor-progress",
				)}
			>
				{children}
			</ButtonPrimitive>
		)}
	</h3>
);

const TileDescription = ({
	className,
	...props
}: React.ComponentProps<"p">) => (
	<p
		data-slot="tile-description"
		className={cn(
			"line-clamp-2 break-words text-muted-foreground text-sm group-has-data-[slot=tile-band]/tile:line-clamp-3",
			className,
		)}
		{...props}
	/>
);

/** Contents and state: short text and badges, pinned to the bottom. */
const TileFooter = ({ className, ...props }: React.ComponentProps<"div">) => (
	<div
		data-slot="tile-footer"
		className={cn(
			"mt-auto flex flex-wrap items-center gap-1.5 pt-1.5 text-muted-foreground text-xs group-has-data-[slot=tile-band]/tile:pt-3",
			className,
		)}
		{...props}
	/>
);

/**
 * The corner cluster above the stretched title: `children` (such as the
 * favourite star), then a `…` menu holding every action. Comes after the body
 * in the DOM, so the title is the first tab stop.
 */
const TileMenu = ({
	actions,
	children,
}: {
	/** Falsy entries are left out, so capability checks can sit inline. */
	actions: (HeaderAction | false | null | undefined)[];
	children?: React.ReactNode;
}) => {
	const declared = actions.filter((action): action is HeaderAction =>
		Boolean(action),
	);

	if (!children && declared.length === 0) {
		return null;
	}

	return (
		<div
			data-slot="tile-menu"
			className="relative z-20 -mt-1 -mr-1 flex shrink-0 items-center gap-0.5 self-start group-has-data-[slot=tile-band]/tile:absolute group-has-data-[slot=tile-band]/tile:top-2.5 group-has-data-[slot=tile-band]/tile:right-2.5 group-has-data-[slot=tile-band]/tile:m-0 group-has-data-[slot=tile-band]/tile:rounded-full group-has-data-[slot=tile-band]/tile:bg-background/80 group-has-data-[slot=tile-band]/tile:p-0.5 group-has-data-[slot=tile-band]/tile:shadow-xs group-has-data-[slot=tile-band]/tile:backdrop-blur"
		>
			{children}
			{declared.length > 0 ? (
				<ActionMenu
					actions={declared}
					triggerVariant="ghost"
					triggerClassName="rounded-full"
				/>
			) : null}
		</div>
	);
};

export {
	Tile,
	TileBand,
	TileBody,
	TileDescription,
	TileFooter,
	TileIcon,
	TileMark,
	TileMenu,
	TileTitle,
};
