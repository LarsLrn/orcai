import { Markdown } from "@/components/chat/markdown";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import type { SearchKnowledgeBaseToolPart } from "@/lib/ai/tools";
import { ToolLoadingState } from "../tool-loading-state";

const SearchKnowledgeBaseTool = ({
	part,
}: {
	part: SearchKnowledgeBaseToolPart;
}) => {
	// Handle loading states
	if (part.state === "input-available" || part.state === "input-streaming") {
		return (
			<ToolLoadingState
				toolName="Searching Knowledge Base"
				description="Please wait while we search the knowledge base..."
			/>
		);
	}

	// Handle completed state
	if (part.state === "output-available" && part.output) {
		return (
			<div className="rounded-lg border bg-muted/20 p-4">
				<p className="mb-2 font-medium text-foreground text-sm">
					Knowledge Base Search Results
				</p>
				<Accordion
					type="single"
					collapsible
					className="w-full"
					defaultValue="item-1"
				>
					{part.output.result.map((result, index) => (
						<AccordionItem key={result.id} value={`item-${index + 1}`}>
							<AccordionTrigger>{result.id}</AccordionTrigger>
							<AccordionContent className="flex flex-col gap-4 text-balance text-xs">
								<Markdown className="text-xs">{result.text}</Markdown>
							</AccordionContent>
						</AccordionItem>
					))}
				</Accordion>
			</div>
		);
	}

	// Handle error state
	if (part.state === "output-error") {
		return (
			<div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4">
				<p className="font-medium text-destructive text-sm">
					Searching Knowledge Base Failed
				</p>
				<p className="text-destructive/80 text-xs">
					There was an error searching the knowledge base. Please try again.
					{part.errorText}
				</p>
			</div>
		);
	}

	return null;
};

export { SearchKnowledgeBaseTool };
