import { Link, type LinkProps } from "@tanstack/react-router";
import type { VariantProps } from "class-variance-authority";
import { EllipsisIcon, type LucideIcon } from "lucide-react";
import type * as React from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLinkItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

/** What happens on activation: a navigation or a callback. */
type ClickAction =
	| {
			linkProps: LinkProps;
			onClick?: never;
			disabled?: never;
			loading?: never;
	  }
	| {
			onClick: () => void;
			linkProps?: never;
			disabled?: boolean;
			loading?: boolean;
	  };

type Action = {
	key: string;
	label: string;
	icon?: LucideIcon;
	className?: string;
} & VariantProps<typeof buttonVariants> &
	ClickAction;

/** An action as a labelled button, or a link styled as one. */
const ActionButton = ({ action }: { action: Action }) => {
	const size = action.size ?? "sm";
	const className = cn("gap-1.5 shadow-none", action.className);
	const icon = action.icon ? (
		<action.icon className={size === "sm" ? "size-3.5" : undefined} />
	) : null;

	if (action.linkProps) {
		return (
			<Link
				{...action.linkProps}
				className={buttonVariants({
					variant: action.variant ?? "outline",
					size,
					className,
				})}
			>
				{icon}
				{action.label}
			</Link>
		);
	}

	return (
		<Button
			onClick={action.onClick}
			variant={action.variant ?? "outline"}
			size={size}
			className={className}
			loading={action.loading}
			disabled={action.disabled}
		>
			{icon}
			{action.label}
		</Button>
	);
};

type HeaderAction = Action & {
	/** A rare action, kept in the `…` menu. */
	overflow?: boolean;
	/** Always in the `…` menu, below the others. */
	destructive?: boolean;
};

/** The `…` button that opens a menu of further actions, with its label as tooltip. */
const OverflowMenuTrigger = ({
	variant = "outline",
	className,
	...props
}: Omit<
	React.ComponentProps<typeof Button>,
	"children" | "size" | "variant"
> & {
	/** Ghost in card corners and table rows, where the outline would crowd. */
	variant?: "outline" | "ghost";
}) => {
	const label = m.common_more_actions();

	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Button
						variant={variant}
						size={variant === "outline" ? "icon" : "icon-sm"}
						aria-label={label}
						className={className}
						{...props}
					/>
				}
			>
				<EllipsisIcon />
			</TooltipTrigger>
			<TooltipContent>{label}</TooltipContent>
		</Tooltip>
	);
};

const isInMenu = (action: HeaderAction) =>
	Boolean(action.overflow || action.destructive);

const ActionMenuItem = ({ action }: { action: HeaderAction }) => {
	const content = (
		<>
			{action.icon ? <action.icon /> : null}
			{action.label}
		</>
	);

	if (action.linkProps) {
		return (
			<DropdownMenuLinkItem render={<Link {...action.linkProps} />}>
				{content}
			</DropdownMenuLinkItem>
		);
	}

	return (
		<DropdownMenuItem
			variant={action.destructive ? "destructive" : "default"}
			disabled={action.disabled || action.loading}
			onClick={action.onClick}
		>
			{content}
		</DropdownMenuItem>
	);
};

/** A `…` menu of actions in declaration order, the destructive ones below a separator. */
const ActionMenu = ({
	actions,
	triggerVariant,
	triggerClassName,
}: {
	actions: HeaderAction[];
	triggerVariant?: React.ComponentProps<typeof OverflowMenuTrigger>["variant"];
	triggerClassName?: string;
}) => {
	const regular = actions.filter((action) => !action.destructive);
	const destructive = actions.filter((action) => action.destructive);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<OverflowMenuTrigger
						variant={triggerVariant}
						className={triggerClassName}
					/>
				}
			/>
			<DropdownMenuContent align="end">
				{regular.map((action) => (
					<ActionMenuItem key={action.key} action={action} />
				))}
				{regular.length > 0 && destructive.length > 0 ? (
					<DropdownMenuSeparator />
				) : null}
				{destructive.map((action) => (
					<ActionMenuItem key={action.key} action={action} />
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

/**
 * A page or section header's actions, in declaration order: labelled buttons,
 * then a `…` menu with the overflow and destructive ones. A menu holding a
 * single harmless action shows it inline instead. Narrow headers keep the menu
 * in the title row and move the buttons to a row of their own.
 */
const HeaderActions = ({
	actions,
	leading,
}: {
	/** Falsy entries are left out, so capability checks can sit inline. */
	actions: (HeaderAction | false | null | undefined)[];
	/** Rendered before the buttons, such as a toggle. */
	leading?: React.ReactNode;
}) => {
	const declared = actions.filter((action): action is HeaderAction =>
		Boolean(action),
	);
	const menuCandidates = declared.filter(isInMenu);
	const inlineSingle =
		menuCandidates.length === 1 && !menuCandidates[0].destructive;
	const inline = declared.filter((action) => inlineSingle || !isInMenu(action));
	const menu = inlineSingle ? [] : menuCandidates;

	if (!leading && inline.length === 0 && menu.length === 0) {
		return null;
	}

	return (
		<div
			data-slot="header-actions"
			className="col-start-2 row-span-2 row-start-1 flex items-center gap-2 self-start justify-self-end"
		>
			{leading || inline.length > 0 ? (
				<div
					data-slot="header-actions-inline"
					className="col-span-full row-start-3 flex flex-wrap items-center gap-2 justify-self-start"
				>
					{leading}
					{inline.map((action) => (
						<ActionButton
							key={action.key}
							action={{
								...action,
								size: action.size ?? "default",
							}}
						/>
					))}
				</div>
			) : null}
			{menu.length > 0 ? (
				<div
					data-slot="header-actions-menu"
					className="col-start-2 row-start-1 self-start justify-self-end"
				>
					<ActionMenu actions={menu} />
				</div>
			) : null}
		</div>
	);
};

export {
	type Action,
	ActionButton,
	ActionMenu,
	type ClickAction,
	type HeaderAction,
	HeaderActions,
	OverflowMenuTrigger,
};
