import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

function Empty({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="empty"
			className={cn(
				"flex w-full min-w-0 flex-1 flex-col items-center justify-center gap-4 text-balance rounded-2xl border-dashed p-12 text-center",
				className,
			)}
			{...props}
		/>
	);
}

function EmptyHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="empty-header"
			className={cn("flex max-w-sm flex-col items-center gap-2", className)}
			{...props}
		/>
	);
}

/*
 * `tone` matches the resource kind of the list that is empty, so the icon
 * well reads as the same thing the filled cards would have shown.
 */
const emptyMediaVariants = cva(
	"mb-2 flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0",
	{
		variants: {
			variant: {
				default: "bg-transparent",
				icon: "flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground [&_svg:not([class*='size-'])]:size-5",
			},
			tone: {
				neutral: "",
				bot: "",
				behaviour: "",
				repository: "",
				asset: "",
			},
		},
		compoundVariants: [
			{
				variant: "icon",
				tone: "bot",
				className: "bg-kind-bot/12 text-kind-bot dark:bg-kind-bot/20",
			},
			{
				variant: "icon",
				tone: "behaviour",
				className:
					"bg-kind-behaviour/12 text-kind-behaviour dark:bg-kind-behaviour/20",
			},
			{
				variant: "icon",
				tone: "repository",
				className:
					"bg-kind-repository/12 text-kind-repository dark:bg-kind-repository/20",
			},
			{
				variant: "icon",
				tone: "asset",
				className: "bg-kind-asset/12 text-kind-asset dark:bg-kind-asset/20",
			},
		],
		defaultVariants: {
			variant: "default",
			tone: "neutral",
		},
	},
);

function EmptyMedia({
	className,
	variant = "default",
	tone = "neutral",
	...props
}: React.ComponentProps<"div"> & VariantProps<typeof emptyMediaVariants>) {
	return (
		<div
			data-slot="empty-icon"
			data-variant={variant}
			data-tone={tone}
			className={cn(
				emptyMediaVariants({
					variant,
					tone,
					className,
				}),
			)}
			{...props}
		/>
	);
}

function EmptyTitle({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="empty-title"
			className={cn(
				"font-heading font-medium text-lg tracking-tight",
				className,
			)}
			{...props}
		/>
	);
}

function EmptyDescription({ className, ...props }: React.ComponentProps<"p">) {
	return (
		<div
			data-slot="empty-description"
			className={cn(
				"text-muted-foreground text-sm/relaxed [&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4",
				className,
			)}
			{...props}
		/>
	);
}

function EmptyContent({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="empty-content"
			className={cn(
				"flex w-full min-w-0 max-w-sm flex-col items-center gap-4 text-balance text-sm",
				className,
			)}
			{...props}
		/>
	);
}

export {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
};
