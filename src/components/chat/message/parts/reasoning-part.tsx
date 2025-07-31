import { Markdown } from "@/components/chat/markdown";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";

interface ReasoningPartProps {
	reasoningParts: Array<{ text: string; id?: string }>;
}

export const ReasoningPart = ({ reasoningParts }: ReasoningPartProps) => {
	if (!reasoningParts || reasoningParts.length === 0) return null;

	// Combine all reasoning text with clear separators for multiple stages
	const combinedReasoning = reasoningParts
		.map((part, index) => {
			if (reasoningParts.length > 1) {
				return `### Reasoning Stage ${index + 1}\n\n${part.text}`;
			}
			return part.text;
		})
		.join("\n\n---\n\n");

	const triggerText =
		reasoningParts.length > 1
			? `Show Reasoning (${reasoningParts.length} stages)`
			: "Show Reasoning";

	return (
		<Accordion
			type="single"
			collapsible
			className="mb-4 rounded-2xl border bg-card px-4"
		>
			<AccordionItem value="item-1">
				<AccordionTrigger className="py-2">{triggerText}</AccordionTrigger>
				<AccordionContent>
					<Markdown className="text-sm">{combinedReasoning}</Markdown>
				</AccordionContent>
			</AccordionItem>
		</Accordion>
	);
};
