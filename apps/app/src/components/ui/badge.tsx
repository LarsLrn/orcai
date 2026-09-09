import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
	"group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-3xl border border-transparent px-2 py-0.5 font-medium text-xs transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/75 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
	{
		variants: {
			variant: {
				default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
				brand:
					"bg-accent-brand text-accent-brand-foreground [a]:hover:bg-accent-brand/85",
				secondary:
					"bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
				destructive:
					"bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
				success:
					"bg-status-success/12 text-status-success focus-visible:ring-status-success/30 dark:bg-status-success/20 [a]:hover:bg-status-success/20 dark:[a]:hover:bg-status-success/30",
				warning:
					"bg-status-warning/12 text-status-warning focus-visible:ring-status-warning/30 dark:bg-status-warning/20 [a]:hover:bg-status-warning/20 dark:[a]:hover:bg-status-warning/30",
				danger:
					"bg-status-danger/12 text-status-danger focus-visible:ring-status-danger/30 dark:bg-status-danger/20 [a]:hover:bg-status-danger/20 dark:[a]:hover:bg-status-danger/30",
				info: "bg-status-info/12 text-status-info focus-visible:ring-status-info/30 dark:bg-status-info/20 [a]:hover:bg-status-info/20 dark:[a]:hover:bg-status-info/30",
				processing:
					"bg-status-processing/12 text-status-processing focus-visible:ring-status-processing/30 dark:bg-status-processing/20 [a]:hover:bg-status-processing/20 dark:[a]:hover:bg-status-processing/30",
				"kind-bot":
					"bg-kind-bot/12 text-kind-bot focus-visible:ring-kind-bot/30 dark:bg-kind-bot/20 [a]:hover:bg-kind-bot/20 dark:[a]:hover:bg-kind-bot/30",
				"kind-behaviour":
					"bg-kind-behaviour/12 text-kind-behaviour focus-visible:ring-kind-behaviour/30 dark:bg-kind-behaviour/20 [a]:hover:bg-kind-behaviour/20 dark:[a]:hover:bg-kind-behaviour/30",
				"kind-repository":
					"bg-kind-repository/12 text-kind-repository focus-visible:ring-kind-repository/30 dark:bg-kind-repository/20 [a]:hover:bg-kind-repository/20 dark:[a]:hover:bg-kind-repository/30",
				"kind-asset":
					"bg-kind-asset/12 text-kind-asset focus-visible:ring-kind-asset/30 dark:bg-kind-asset/20 [a]:hover:bg-kind-asset/20 dark:[a]:hover:bg-kind-asset/30",
				outline:
					"border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
				ghost:
					"hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
				link: "text-primary underline-offset-4 hover:underline",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

function Badge({
	className,
	variant = "default",
	render,
	...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
	return useRender({
		defaultTagName: "span",
		props: mergeProps<"span">(
			{
				className: cn(
					badgeVariants({
						variant,
					}),
					className,
				),
			},
			props,
		),
		render,
		state: {
			slot: "badge",
			variant,
		},
	});
}

export { Badge, badgeVariants };
