import type { ReasoningUIPart } from "ai";
import {
	Reasoning,
	ReasoningContent,
	ReasoningTrigger,
} from "@/components/ai-elements/reasoning";

export const ReasoningPart = ({ part }: { part: ReasoningUIPart }) => {
	return (
		<Reasoning className="w-full" isStreaming={part.state === "streaming"}>
			<ReasoningTrigger />
			<ReasoningContent className="text-muted-foreground">
				{part.text}
			</ReasoningContent>
		</Reasoning>
	);
};
