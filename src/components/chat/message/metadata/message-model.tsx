import { BrainCircuitIcon } from "lucide-react";
import type { CustomUIMessage } from "@/lib/ai/tools";

const MessageModel = ({ message }: { message: CustomUIMessage }) => {
	if (message.role === "user") return null;

	if (!message.metadata?.model) return null;

	const { model } = message.metadata;

	return (
		<div className="mt-1 flex items-center justify-end">
			<span className="flex h-8 items-center gap-1 rounded-md px-2 py-1 text-muted-foreground text-xs transition-colors hover:bg-muted/50 hover:text-foreground">
				<BrainCircuitIcon className="h-3 w-3" />
				<span className="font-medium">{model}</span>
			</span>
		</div>
	);
};

export { MessageModel };
