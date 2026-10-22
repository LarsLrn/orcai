import { PinIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

const PinMark = ({ className }: { className?: string }) => (
	<PinIcon
		role="img"
		aria-label={m.chat_pinned_label()}
		className={cn("size-3.5 shrink-0 text-muted-foreground", className)}
	/>
);

export { PinMark };
