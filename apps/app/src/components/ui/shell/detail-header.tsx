import type * as React from "react";
import {
	PageDescription,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { cn } from "@/lib/utils";

/*
 * The store header of a detail page: the band, the icon well overlapping it,
 * then the heading with the name, its meta line and `HeaderActions`, and the
 * description. The same parts open a Library item and a catalogue entry.
 */

const DetailHeader = ({
	className,
	...props
}: React.ComponentProps<"header">) => (
	<header
		data-slot="detail-header"
		className={cn("flex flex-col", className)}
		{...props}
	/>
);

/** The kind-tinted band; its child is the large faint glyph. */
const DetailHeaderBand = ({
	className,
	...props
}: React.ComponentProps<"div">) => (
	<div
		data-slot="detail-header-band"
		aria-hidden="true"
		className={cn(
			"relative h-28 overflow-hidden rounded-3xl bg-linear-to-br sm:h-36 [&>svg]:absolute [&>svg]:-right-6 [&>svg]:-bottom-10 [&>svg]:size-40 [&>svg]:text-foreground/[0.07] sm:[&>svg]:size-52",
			className,
		)}
		{...props}
	/>
);

/** The icon well over the band's lower edge; `className` tints it. A `TileMark` child sits on its corner. */
const DetailHeaderIcon = ({
	className,
	children,
	...props
}: React.ComponentProps<"div">) => (
	<div
		data-slot="detail-header-icon"
		className="relative z-10 -mt-10 ml-5 w-fit rounded-3xl border-4 border-background bg-background shadow-sm sm:ml-8 [&_[data-slot=tile-mark]]:-right-1 [&_[data-slot=tile-mark]]:-bottom-1 [&_[data-slot=tile-mark]]:size-6 [&_[data-slot=tile-mark]]:ring-background"
		{...props}
	>
		<div
			className={cn(
				"flex size-16 items-center justify-center rounded-2xl bg-muted [&>svg]:size-8",
				className,
			)}
		>
			{children}
		</div>
	</div>
);

/**
 * The name, the meta line and `HeaderActions`. Narrow headers keep the `…`
 * menu next to the name and move the buttons below the meta line.
 */
const DetailHeaderHeading = ({
	className,
	...props
}: React.ComponentProps<typeof PageHeader>) => (
	<PageHeader className={cn("mt-4 overflow-visible", className)} {...props} />
);

const DetailHeaderTitle = ({
	className,
	...props
}: React.ComponentProps<typeof PageTitle>) => (
	<PageTitle className={cn("min-w-0 break-words", className)} {...props} />
);

/** The kind badge, state badges and provenance under the name. */
const DetailHeaderMeta = ({
	className,
	...props
}: React.ComponentProps<"div">) => (
	<div
		data-slot="detail-header-meta"
		className={cn(
			"flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 text-muted-foreground text-sm",
			className,
		)}
		{...props}
	/>
);

const DetailHeaderDescription = ({
	className,
	...props
}: React.ComponentProps<typeof PageDescription>) => (
	<PageDescription className={cn("mt-4 break-words", className)} {...props} />
);

export {
	DetailHeader,
	DetailHeaderBand,
	DetailHeaderDescription,
	DetailHeaderHeading,
	DetailHeaderIcon,
	DetailHeaderMeta,
	DetailHeaderTitle,
};
