import { Link } from "@tanstack/react-router";
import { EllipsisIcon } from "lucide-react";
import type * as React from "react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLinkItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	ResourceCardAction,
	type ResourceCardActionItem,
} from "@/components/ui/shell/resource-card";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { m } from "@/paraglide/messages";

type HeaderAction = ResourceCardActionItem & {
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
	const regular = menu.filter((action) => !action.destructive);
	const destructive = menu.filter((action) => action.destructive);

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
						<ResourceCardAction
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
					<DropdownMenu>
						<DropdownMenuTrigger render={<OverflowMenuTrigger />} />
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
				</div>
			) : null}
		</div>
	);
};

export { type HeaderAction, HeaderActions, OverflowMenuTrigger };
