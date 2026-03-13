import { cn } from "@/lib/utils";

type SectionGridLayout = "auto" | "2" | "3" | "4";
type SectionGridGap = "sm" | "md" | "lg";

const SECTION_GRID_LAYOUT_CLASSES: Record<SectionGridLayout, string> = {
	auto: "grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))]",
	"2": "grid-cols-1 md:grid-cols-2",
	"3": "grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
	"4": "grid-cols-1 md:grid-cols-2 xl:grid-cols-4",
};

const SECTION_GRID_GAP_CLASSES: Record<SectionGridGap, string> = {
	sm: "gap-3",
	md: "gap-4",
	lg: "gap-6",
};

const Section = ({ className, ...props }: React.ComponentProps<"section">) => {
	return (
		<section
			data-slot="section"
			className={cn("group/section relative flex flex-col gap-6", className)}
			{...props}
		/>
	);
};

const SectionHeader = ({
	className,
	...props
}: React.ComponentProps<"div">) => {
	return (
		<div
			data-slot="section-header"
			className={cn(
				"group/section-header @container/section-header grid auto-rows-min items-start gap-2 has-data-[slot=section-action]:grid-cols-[1fr_auto] has-data-[slot=section-description]:grid-rows-[auto_auto] max-sm:has-data-[slot=section-action]:grid-cols-1 max-sm:*:data-[slot=section-action]:col-start-1 max-sm:*:data-[slot=section-action]:row-start-3 max-sm:*:data-[slot=section-action]:justify-self-start [.border-b]:pb-5",
				className,
			)}
			{...props}
		/>
	);
};

const SectionTitle = ({ className, ...props }: React.ComponentProps<"h2">) => {
	return (
		<h2
			data-slot="section-title"
			className={cn(
				"text-balance font-semibold text-2xl text-foreground/70 tracking-tight md:text-2xl",
				className,
			)}
			{...props}
		/>
	);
};

const SectionDescription = ({
	className,
	...props
}: React.ComponentProps<"p">) => {
	return (
		<p
			data-slot="section-description"
			className={cn("text-muted-foreground text-sm leading-relaxed", className)}
			{...props}
		/>
	);
};

const SectionAction = ({
	className,
	...props
}: React.ComponentProps<"div">) => {
	return (
		<div
			data-slot="section-action"
			className={cn(
				"col-start-2 row-span-2 row-start-1 flex flex-wrap items-center justify-end gap-2 self-start justify-self-end",
				className,
			)}
			{...props}
		/>
	);
};

const SectionContent = ({
	className,
	...props
}: React.ComponentProps<"div">) => {
	return (
		<div data-slot="section-content" className={cn(className)} {...props} />
	);
};

const SectionGrid = ({
	layout = "auto",
	gap = "md",
	className,
	...props
}: React.ComponentProps<"div"> & {
	layout?: SectionGridLayout;
	gap?: SectionGridGap;
}) => {
	return (
		<div
			data-slot="section-grid"
			className={cn(
				"grid",
				SECTION_GRID_LAYOUT_CLASSES[layout],
				SECTION_GRID_GAP_CLASSES[gap],
				className,
			)}
			{...props}
		/>
	);
};

const SectionFooter = ({
	className,
	...props
}: React.ComponentProps<"div">) => {
	return (
		<div
			data-slot="section-footer"
			className={cn("flex items-center [.border-t]:pt-5", className)}
			{...props}
		/>
	);
};

export {
	Section,
	SectionAction,
	SectionContent,
	SectionDescription,
	SectionFooter,
	SectionGrid,
	type SectionGridGap,
	type SectionGridLayout,
	SectionHeader,
	SectionTitle,
};
