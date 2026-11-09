import { CircleHelpIcon, type LucideIcon } from "lucide-react";
import { type Action, ActionButton } from "@/components/ui/shell/actions";
import { cn } from "@/lib/utils";

/** The one empty, unavailable or failed state: an icon, a title, a sentence and actions. */
const Placeholder = ({
	title,
	description,
	className,
	Icon = CircleHelpIcon,
	actions,
	children,
	role,
	size = "default",
}: {
	title: string;
	description?: string;
	className?: string;
	Icon?: LucideIcon;
	actions?: Action[];
	/** Controls that are no plain action, such as a menu, shown before `actions`. */
	children?: React.ReactNode;
	role?: "status" | "alert";
	/** `sm` for narrow places such as the sidebar and dialogs. */
	size?: "default" | "sm";
}): React.ReactNode => {
	const small = size === "sm";

	return (
		<div
			data-slot="placeholder"
			role={role}
			className={cn(
				"flex w-full min-w-0 flex-1 flex-col items-center justify-center gap-4 rounded-2xl border-dashed p-12 text-center text-balance",
				small && "gap-3 p-4",
				className,
			)}
		>
			<div className="flex max-w-sm flex-col items-center gap-2">
				<div
					className={cn(
						"bg-muted text-foreground mb-2 flex size-10 shrink-0 items-center justify-center rounded-xl [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
						small && "mb-0 size-8 [&_svg:not([class*='size-'])]:size-4",
					)}
				>
					<Icon aria-hidden="true" />
				</div>
				<div
					className={cn(
						"font-heading text-lg font-medium tracking-tight",
						small && "text-sm",
					)}
				>
					{title}
				</div>
				{description && (
					<div className="text-muted-foreground text-sm/relaxed">
						{description}
					</div>
				)}
			</div>
			{children || actions?.length ? (
				<div className="flex w-full max-w-sm min-w-0 flex-row flex-wrap items-center justify-center gap-2 text-sm text-balance">
					{children}
					{actions?.map((action) => (
						<ActionButton key={action.key} action={action} />
					))}
				</div>
			) : null}
		</div>
	);
};

export { Placeholder };
