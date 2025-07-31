import { Loader2Icon } from "lucide-react";

interface ToolLoadingStateProps {
	toolName: string;
	description?: string;
}

export const ToolLoadingState = ({
	toolName,
	description = "Please wait while we process your request...",
}: ToolLoadingStateProps) => {
	return (
		<div className="flex items-center gap-3 rounded-lg border border-dashed bg-muted/50 p-4">
			<Loader2Icon className="h-4 w-4 animate-spin text-primary" />
			<div className="flex flex-col gap-1">
				<p className="font-medium text-foreground text-sm">{toolName}</p>
				<p className="text-muted-foreground text-xs">{description}</p>
			</div>
		</div>
	);
};
