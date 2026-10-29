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
}: {
	title: string;
	description?: string;
	className?: string;
	Icon?: LucideIcon;
	tone?: React.ComponentProps<typeof EmptyMedia>["tone"];
	actions?: Action[];
}): React.ReactNode => {
	return (
		<Empty className={cn(className)}>
			<EmptyHeader>
				<EmptyMedia variant="icon" tone={tone}>
					<Icon />
				</EmptyMedia>
				<EmptyTitle>{title}</EmptyTitle>
				{description && <EmptyDescription>{description}</EmptyDescription>}
			</EmptyHeader>
			<EmptyContent className="flex flex-row flex-wrap justify-center gap-2">
				{actions?.map((action) => (
					<ActionButton key={action.key} action={action} />
				))}
			</EmptyContent>
		</Empty>
	);
};

export { Placeholder };
