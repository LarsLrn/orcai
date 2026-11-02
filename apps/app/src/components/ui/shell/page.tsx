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
				"group/page-header @container/page-header relative grid auto-rows-min items-start gap-3 has-data-[slot=header-actions]:grid-cols-[minmax(0,1fr)_auto] has-data-[slot=page-action]:grid-cols-[minmax(0,1fr)_auto] has-data-[slot=page-description]:grid-rows-[auto_auto] @max-3xl/page-header:*:col-span-full @max-3xl/page-header:*:data-[slot=header-actions]:contents @max-3xl/page-header:*:data-[slot=page-action]:row-start-3 @max-3xl/page-header:*:data-[slot=page-action]:justify-self-start @max-3xl/page-header:has-data-[slot=header-actions-menu]:*:data-[slot=page-title]:col-span-1 [.border-b]:pb-6",
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
				"font-heading max-w-4xl min-w-0 text-3xl font-semibold tracking-tight text-balance break-words md:text-4xl",
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
				"text-muted-foreground max-w-3xl min-w-0 text-sm leading-relaxed break-words md:text-base",
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
	PageAction,
	PageContent,
	PageDescription,
	PageFooter,
	PageHeader,
	PageTitle,
};
