import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

const AssistantPlaceholder = ({ className }: { className?: string }) => (
	<div className={cn("flex flex-col gap-1 text-center", className)}>
		<h2 className="font-heading font-semibold text-xl">
			{m.assistant_placeholder_title()}
		</h2>
		<p className="text-muted-foreground text-sm">
			{m.assistant_placeholder_description()}
		</p>
	</div>
);

export { AssistantPlaceholder };
