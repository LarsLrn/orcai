import { Loader2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
	return (
		<Loader2Icon
			role="status"
			aria-label={m.common_loading_label()}
			className={cn("size-4 animate-spin border-none", className)}
			{...props}
		/>
	);
}

export { Spinner };
