import { cn } from "@/lib/utils";

const Page = ({ className, ...props }: React.ComponentProps<"div">) => {
	return (
		<div
			data-slot="page"
			className={cn("group/page relative flex flex-col gap-10", className)}
			{...props}
		/>
	);
};

const PageHeader = ({ className, ...props }: React.ComponentProps<"div">) => {
	return (
		<div
			data-slot="page-header"
			className={cn(
				"group/page-header @container/page-header relative grid auto-rows-min items-start gap-3 overflow-hidden has-data-[slot=page-action]:grid-cols-[1fr_auto] has-data-[slot=page-description]:grid-rows-[auto_auto] max-sm:has-data-[slot=page-action]:grid-cols-1 max-sm:*:data-[slot=page-action]:col-start-1 max-sm:*:data-[slot=page-action]:row-start-3 max-sm:*:data-[slot=page-action]:justify-self-start [.border-b]:pb-6",
				className,
			)}
			{...props}
		/>
	);
};

const PageTitle = ({ className, ...props }: React.ComponentProps<"h1">) => {
	return (
		<h1
			data-slot="page-title"
			className={cn(
				"max-w-4xl text-balance font-semibold text-3xl tracking-tight md:text-4xl",
				className,
			)}
			{...props}
		/>
	);
};

const PageDescription = ({
	className,
	...props
}: React.ComponentProps<"p">) => {
	return (
		<p
			data-slot="page-description"
			className={cn(
				"max-w-3xl text-muted-foreground text-sm leading-relaxed md:text-base",
				className,
			)}
			{...props}
		/>
	);
};

const PageAction = ({ className, ...props }: React.ComponentProps<"div">) => {
	return (
		<div
			data-slot="page-action"
			className={cn(
				"col-start-2 row-span-2 row-start-1 flex flex-wrap items-center justify-end gap-2 self-start justify-self-end",
				className,
			)}
			{...props}
		/>
	);
};

const PageContent = ({ className, ...props }: React.ComponentProps<"div">) => {
	return <div data-slot="page-content" className={cn(className)} {...props} />;
};

const PageFooter = ({ className, ...props }: React.ComponentProps<"div">) => {
	return (
		<div
			data-slot="page-footer"
			className={cn(
				"flex items-center rounded-b-xl [.border-t]:pt-6",
				className,
			)}
			{...props}
		/>
	);
};

export {
	Page,
	PageHeader,
	PageTitle,
	PageDescription,
	PageAction,
	PageContent,
	PageFooter,
};
