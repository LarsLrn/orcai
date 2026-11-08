import { CircleHelpIcon, type LucideIcon } from "lucide-react";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { type Action, ActionButton } from "@/components/ui/shell/actions";
import { cn } from "@/lib/utils";

const Placeholder = ({
	title,
	description,
	className,
	Icon = CircleHelpIcon,
	tone,
	actions,
	size = "default",
}: {
	title: string;
	description?: string;
	className?: string;
	Icon?: LucideIcon;
	tone?: React.ComponentProps<typeof EmptyMedia>["tone"];
	actions?: Action[];
	/** `sm` for narrow places such as the sidebar and dialogs. */
	size?: "default" | "sm";
}): React.ReactNode => {
	const small = size === "sm";

	return (
		<Empty className={cn(small && "gap-3 p-4", className)}>
			<EmptyHeader>
				<EmptyMedia
					variant="icon"
					tone={tone}
					className={cn(
						small && "mb-0 size-8 [&_svg:not([class*='size-'])]:size-4",
					)}
				>
					<Icon />
				</EmptyMedia>
				<EmptyTitle className={cn(small && "text-sm")}>{title}</EmptyTitle>
				{description && <EmptyDescription>{description}</EmptyDescription>}
			</EmptyHeader>
			{actions?.length ? (
				<EmptyContent className="flex flex-row flex-wrap justify-center gap-2">
					{actions.map((action) => (
						<ActionButton key={action.key} action={action} />
					))}
				</EmptyContent>
			) : null}
		</Empty>
	);
};

export { Placeholder };
