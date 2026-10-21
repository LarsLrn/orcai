import { Separator } from "@/components/ui/separator";
import { m } from "@/paraglide/messages";

/** Marks where the model's view of the chat starts from a summary. */
const MessageCompacted = () => (
	<div className="relative my-2 h-5 text-xs">
		<Separator className="absolute inset-0 top-1/2" />
		<span className="relative mx-auto block w-fit bg-background px-2 text-muted-foreground">
			{m.chat_message_compacted()}
		</span>
	</div>
);

export { MessageCompacted };
