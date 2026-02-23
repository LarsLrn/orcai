import { CircleHelpIcon, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";

const Placeholder = ({
	title,
	description,
	className,
	Icon = CircleHelpIcon,
	primaryAction,
	secondaryAction,
}: {
	title: string;
	description?: string;
	className?: string;
	Icon?: LucideIcon;
	primaryAction?: {
		label: string;
		onClick: () => void;
	};
	secondaryAction?: {
		label: string;
		onClick: () => void;
	};
}): React.ReactNode => {
	return (
		<Empty className={cn(className)}>
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<Icon />
				</EmptyMedia>
				<EmptyTitle>{title}</EmptyTitle>
				{description && <EmptyDescription>{description}</EmptyDescription>}
			</EmptyHeader>
			<EmptyContent className="flex flex-row justify-center gap-2">
				{primaryAction && (
					<Button onClick={primaryAction.onClick}>{primaryAction.label}</Button>
				)}
				{secondaryAction && (
					<Button variant="outline" onClick={secondaryAction.onClick}>
						{secondaryAction.label}
					</Button>
				)}
			</EmptyContent>
		</Empty>
	);
};

export { Placeholder };
