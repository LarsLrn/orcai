import { Link, type LinkProps } from "@tanstack/react-router";
import type { VariantProps } from "class-variance-authority";
import { type LucideIcon, MoreHorizontalIcon } from "lucide-react";
import type * as React from "react";
import { Badge, type badgeVariants } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ResourceCardClickAction =
	| { linkProps: LinkProps; onClick?: never; disabled?: never }
	| { onClick: () => void; linkProps?: never; disabled?: boolean };

type ResourceCardPrimaryAction = ResourceCardClickAction;

const isActionInteractive = (action?: ResourceCardClickAction) =>
	Boolean(action?.linkProps || (action?.onClick && !action.disabled));

const ResourceCard = ({
	className,
	...props
}: React.ComponentProps<typeof Card>) => {
	return (
		<Card
			size="sm"
			className={cn(
				"has-[>[data-slot=resource-card-body] relative h-full gap-2 border-border/70 bg-card/95 shadow-xs transition-all duration-200 has-[>[data-slot=resource-card-body][data-interactive=true]]:hover:border-border has-[>[data-slot=resource-card-body][data-interactive=true]]:hover:shadow-lg",
				className,
			)}
			{...props}
		/>
	);
};

const ResourceCardBody = ({
	action,
	className,
	children,
}: {
	action?: ResourceCardPrimaryAction;
	className?: string;
	children: React.ReactNode;
}) => {
	const isInteractive = isActionInteractive(action);
	const bodyClassName = cn(
		"block rounded-2xl",
		isInteractive &&
			"no-underline outline-none ring-ring/50 transition-all duration-200 hover:bg-muted/20 focus-visible:ring-[3px]",
		className,
	);

	if (action?.linkProps) {
		return (
			<Link
				{...action.linkProps}
				data-slot="resource-card-body"
				data-interactive="true"
				className={bodyClassName}
			>
				{children}
			</Link>
		);
	}

	if (action?.onClick) {
		return (
			<button
				type="button"
				onClick={action.onClick}
				disabled={action.disabled}
				data-slot="resource-card-body"
				data-interactive={action.disabled ? "false" : "true"}
				className={cn(
					bodyClassName,
					"w-full border-0 bg-transparent text-left",
					action.disabled &&
						"cursor-not-allowed opacity-70 hover:bg-transparent",
				)}
			>
				{children}
			</button>
		);
	}

	return (
		<div
			data-slot="resource-card-body"
			data-interactive="false"
			className={bodyClassName}
		>
			{children}
		</div>
	);
};

const ResourceCardMenu = ({
	className,
	...props
}: React.ComponentProps<"div">) => {
	return (
		<div
			data-slot="resource-card-menu"
			className={cn("absolute top-2 right-2 z-10 flex items-center", className)}
			{...props}
		/>
	);
};

const ResourceCardHeader = ({
	className,
	...props
}: React.ComponentProps<typeof CardHeader>) => {
	return <CardHeader className={cn("gap-3", className)} {...props} />;
};

const ResourceCardTitle = ({
	action,
	className,
	children,
	...props
}: React.ComponentProps<typeof CardTitle> & {
	action?: ResourceCardPrimaryAction;
}) => {
	const titleClassName = cn(
		"line-clamp-1 font-semibold text-base tracking-tight",
		className,
	);

	if (action?.linkProps) {
		return (
			<CardTitle className={titleClassName} {...props}>
				<Link
					{...action.linkProps}
					className="inline rounded-sm no-underline outline-none ring-ring/50 transition-colors hover:text-primary focus-visible:ring-[3px]"
				>
					{children}
				</Link>
			</CardTitle>
		);
	}

	if (action?.onClick) {
		return (
			<CardTitle className={titleClassName} {...props}>
				<button
					type="button"
					onClick={action.onClick}
					disabled={action.disabled}
					className={cn(
						"rounded-sm border-0 bg-transparent p-0 text-left text-inherit outline-none ring-ring/50 transition-colors hover:text-primary focus-visible:ring-[3px]",
						action.disabled &&
							"cursor-not-allowed opacity-70 hover:text-inherit",
					)}
				>
					{children}
				</button>
			</CardTitle>
		);
	}

	return (
		<CardTitle className={titleClassName} {...props}>
			{children}
		</CardTitle>
	);
};

const ResourceCardDescription = ({
	className,
	...props
}: React.ComponentProps<typeof CardDescription>) => {
	return (
		<CardDescription
			className={cn("line-clamp-2 text-sm", className)}
			{...props}
		/>
	);
};

const ResourceCardContent = ({
	className,
	...props
}: React.ComponentProps<typeof CardContent>) => {
	return <CardContent className={cn("space-y-3.5", className)} {...props} />;
};

type ResourceCardBadgeItem = {
	label: string;
	icon?: LucideIcon;
} & VariantProps<typeof badgeVariants>;

const ResourceCardBadges = ({
	badges,
	className,
}: {
	badges: ResourceCardBadgeItem[];
	className?: string;
}) => {
	if (badges.length === 0) {
		return null;
	}

	return (
		<div className={cn("flex flex-wrap gap-1.5", className)}>
			{badges.map((badge) => (
				<Badge
					key={badge.label}
					variant={badge.variant ?? "secondary"}
					className="px-2.5 font-medium"
				>
					{badge.icon ? <badge.icon className="h-3 w-3" /> : null}
					{badge.label}
				</Badge>
			))}
		</div>
	);
};

type ResourceCardMetaItem = {
	label: string;
	value: string;
};

const ResourceCardMeta = ({
	meta,
	className,
}: {
	meta: ResourceCardMetaItem[];
	className?: string;
}) => {
	if (meta.length === 0) {
		return null;
	}

	return (
		<dl className={cn("grid gap-2 text-xs", className)}>
			{meta.map((entry) => (
				<div
					key={entry.label}
					className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3"
				>
					<dt className="truncate text-muted-foreground">{entry.label}</dt>
					<dd className="truncate font-medium text-foreground/90">
						{entry.value}
					</dd>
				</div>
			))}
		</dl>
	);
};

const ResourceCardFooter = ({
	className,
	...props
}: React.ComponentProps<typeof CardFooter>) => {
	return (
		<CardFooter
			className={cn("flex-wrap gap-2 border-t bg-muted/15", className)}
			{...props}
		/>
	);
};

type ResourceCardActionItemBase = {
	key: string;
	label: string;
	icon?: LucideIcon;
	className?: string;
} & VariantProps<typeof buttonVariants>;

type ResourceCardActionItem = ResourceCardActionItemBase &
	ResourceCardClickAction;

const ResourceCardAction = ({ action }: { action: ResourceCardActionItem }) => {
	if (action.linkProps) {
		return (
			<Link
				{...action.linkProps}
				className={buttonVariants({
					variant: action.variant ?? "outline",
					size: action.size ?? "sm",
					className: cn("gap-1.5 shadow-none", action.className),
				})}
			>
				{action.icon ? <action.icon className="h-3.5 w-3.5" /> : null}
				{action.label}
			</Link>
		);
	}

	return (
		<Button
			onClick={action.onClick}
			variant={action.variant ?? "outline"}
			size="sm"
			className={cn("gap-1.5 shadow-none", action.className)}
			disabled={action.disabled}
		>
			{action.icon ? <action.icon className="h-3.5 w-3.5" /> : null}
			{action.label}
		</Button>
	);
};

const ResourceCardMenuTrigger = ({
	action,
	icon: Icon = MoreHorizontalIcon,
	label = "Open menu",
	className,
	onClick,
	disabled,
	...props
}: {
	action?: ResourceCardClickAction;
	icon?: LucideIcon;
	label?: string;
} & Omit<
	React.ComponentProps<typeof Button>,
	"children" | "variant" | "size"
>) => {
	const triggerClassName = cn("size-8 data-[state=open]:bg-muted", className);

	if (action?.linkProps) {
		return (
			<Link
				{...action.linkProps}
				className={buttonVariants({
					variant: "ghost",
					size: "icon-sm",
					className: triggerClassName,
				})}
			>
				<Icon className="h-4 w-4" />
				<span className="sr-only">{label}</span>
			</Link>
		);
	}

	return (
		<Button
			variant="ghost"
			size="icon-sm"
			className={triggerClassName}
			onClick={(event) => {
				onClick?.(event);
				if (!event.defaultPrevented && action?.onClick) {
					action.onClick();
				}
			}}
			disabled={disabled ?? action?.disabled}
			{...props}
		>
			<Icon className="h-4 w-4" />
			<span className="sr-only">{label}</span>
		</Button>
	);
};

export {
	ResourceCard,
	ResourceCardBody,
	ResourceCardMenu,
	ResourceCardMenuTrigger,
	ResourceCardHeader,
	ResourceCardTitle,
	ResourceCardDescription,
	ResourceCardContent,
	ResourceCardBadges,
	ResourceCardMeta,
	ResourceCardFooter,
	ResourceCardAction,
	type ResourceCardBadgeItem,
	type ResourceCardMetaItem,
	type ResourceCardActionItem,
	type ResourceCardClickAction,
	type ResourceCardPrimaryAction,
};
