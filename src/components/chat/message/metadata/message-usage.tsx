import { Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import type { CustomUIMessage } from "@/lib/ai/tools";

const MessageUsage = ({ message }: { message: CustomUIMessage }) => {
	if (message.role === "user") return null;

	if (!message.metadata?.totalUsage || !message.metadata.totalUsage.totalTokens)
		return null;

	const { inputTokens, outputTokens, totalTokens } =
		message.metadata.totalUsage;

	return (
		<div className="mt-1 flex items-center justify-end">
			<Popover>
				<PopoverTrigger asChild>
					<button
						type="button"
						className="flex items-center gap-1 rounded-md px-2 py-1 text-muted-foreground text-xs transition-colors hover:bg-muted/50 hover:text-foreground"
					>
						<Zap className="h-3 w-3" />
						<span className="font-medium">{totalTokens.toLocaleString()}</span>
						<span className="text-muted-foreground/70">tokens</span>
					</button>
				</PopoverTrigger>
				<PopoverContent className="w-auto p-3" side="top" align="end">
					<div className="space-y-2">
						<div className="mb-2 font-medium text-foreground text-xs">
							Token Usage
						</div>
						<div className="flex flex-col gap-2">
							{inputTokens && (
								<div className="flex items-center justify-between gap-4">
									<span className="text-muted-foreground text-xs">Input:</span>
									<Badge variant="secondary" className="font-normal text-xs">
										{inputTokens.toLocaleString()}
									</Badge>
								</div>
							)}
							{outputTokens && (
								<div className="flex items-center justify-between gap-4">
									<span className="text-muted-foreground text-xs">Output:</span>
									<Badge variant="secondary" className="font-normal text-xs">
										{outputTokens.toLocaleString()}
									</Badge>
								</div>
							)}
							<div className="flex items-center justify-between gap-4 border-t pt-1">
								<span className="font-medium text-xs">Total:</span>
								<Badge variant="default" className="font-medium text-xs">
									{totalTokens.toLocaleString()}
								</Badge>
							</div>
						</div>
					</div>
				</PopoverContent>
			</Popover>
		</div>
	);
};

export { MessageUsage };
