import { CircleHelp } from "lucide-react";
import type { ReactNode } from "react";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { m } from "@/paraglide/messages";

interface InfoDotProps {
	content: ReactNode;
}

const InfoDot = ({ content }: InfoDotProps) => {
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<button
						type="button"
						className="inline-flex shrink-0 rounded-full text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/75"
					/>
				}
			>
				<CircleHelp className="size-4" />
				<span className="sr-only">{m.common_info_dot_trigger()}</span>
			</TooltipTrigger>
			<TooltipContent>{content}</TooltipContent>
		</Tooltip>
	);
};

export { InfoDot };
