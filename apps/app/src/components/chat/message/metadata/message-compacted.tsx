import { Separator } from "@/components/ui/separator";
import { m } from "@/paraglide/messages";

/** Marks where the model's view of the chat starts from a summary. */
const MessageCompacted = () => (
	<div className="relative my-2 h-5 text-xs">
		<Separator className="absolute inset-0 top-1/2" />
		<span className="bg-background text-muted-foreground relative mx-auto block w-fit px-2">
			{m.chat_message_compacted()}
		</span>
	</div>
);

export { MessageCompacted };
