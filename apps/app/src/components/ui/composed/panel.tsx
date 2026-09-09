import { cva, type VariantProps } from "class-variance-authority";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const Panel = ({ className, ...props }: React.ComponentProps<"section">) => (
	<section
		data-slot="panel"
		className={cn(
			"flex h-full flex-col overflow-hidden rounded-4xl bg-card text-card-foreground text-sm shadow-md ring-1 ring-foreground/5 dark:ring-foreground/10",
			className,
		)}
		{...props}
	/>
);

const PanelHeader = ({ className, ...props }: React.ComponentProps<"div">) => (
	<div
		className={cn(
			"flex items-center justify-between gap-3 px-5 py-4",
			className,
		)}
		{...props}
	/>
);

const PanelTitle = ({ className, ...props }: React.ComponentProps<"h2">) => (
	<h2
		className={cn("font-heading font-medium text-base", className)}
		{...props}
	/>
);

const PanelRows = ({ className, ...props }: React.ComponentProps<"div">) => (
	<div
		className={cn(
			"flex flex-1 flex-col divide-y divide-border border-border border-t",
			className,
		)}
		{...props}
	/>
);

const panelRowVariants = cva(
	"flex min-h-14 items-center justify-between gap-4 px-5 py-3",
	{
		variants: {
			variant: {
				default: "",
				/** For rows that navigate somewhere, e.g. rendered as a `Link`. */
				link: "no-underline outline-none ring-inset transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/75 active:bg-surface-pressed",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

const PanelRow = ({
	className,
	variant,
	...props
}: React.ComponentProps<"div"> & VariantProps<typeof panelRowVariants>) => (
	<div
		className={cn(
			panelRowVariants({
				variant,
				className,
			}),
		)}
		{...props}
	/>
);

/** Empty states and footnotes, written as a sentence rather than an icon. */
const PanelNote = ({ className, ...props }: React.ComponentProps<"p">) => (
	<p
		className={cn(
			"flex-1 border-border border-t px-5 py-4 text-muted-foreground text-sm leading-relaxed",
			className,
		)}
		{...props}
	/>
);

const PanelSkeleton = ({ rows }: { rows: number }) => (
	<Panel aria-busy="true">
		<PanelHeader>
			<Skeleton className="h-5 w-32" />
			<Skeleton className="h-8 w-24" />
		</PanelHeader>
		<PanelRows>
			{Array.from(
				{
					length: rows,
				},
				(_, index) => (
					<PanelRow key={index}>
						<div className="flex min-w-0 flex-col gap-1">
							<Skeleton className="h-5 w-40" />
							<Skeleton className="h-4 w-56" />
						</div>
						<Skeleton className="h-5 w-12" />
					</PanelRow>
				),
			)}
		</PanelRows>
	</Panel>
);

export {
	Panel,
	PanelHeader,
	PanelNote,
	PanelRow,
	PanelRows,
	PanelSkeleton,
	PanelTitle,
	panelRowVariants,
};
