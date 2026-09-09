import { CircleHelpIcon, type LucideIcon } from "lucide-react";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import {
	ResourceCardAction,
	type ResourceCardActionItem,
} from "@/components/ui/shell/resource-card";
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
	actions?: ResourceCardActionItem[];
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
			<EmptyContent className="flex flex-row justify-center gap-2">
				{actions?.map((action) => (
					<ResourceCardAction key={action.key} action={action} />
				))}
			</EmptyContent>
		</Empty>
	);
};

export { Placeholder };
