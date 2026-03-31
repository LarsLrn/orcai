import { CircleHelp } from "lucide-react";
import type { ReactNode } from "react";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";

interface InfoDotProps {
	content: ReactNode;
}

const InfoDot = ({ content }: InfoDotProps) => {
	return (
		<Tooltip>
			<TooltipTrigger
				render={<CircleHelp className="size-4 text-muted-foreground" />}
			/>
			<TooltipContent>{content}</TooltipContent>
		</Tooltip>
	);
};

export { InfoDot };
