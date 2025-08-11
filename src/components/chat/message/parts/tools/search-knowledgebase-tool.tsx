import { FileTextIcon } from "lucide-react";
import {
	Tool,
	ToolContent,
	ToolHeader,
	ToolInput,
	ToolOutput,
} from "@/components/ai-elements/tool";
import { Markdown } from "@/components/app/markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import type { SearchKnowledgeBaseToolPart } from "@/lib/ai/tools";

const SearchKnowledgeBaseTool = ({
	part,
}: {
	part: SearchKnowledgeBaseToolPart;
}) => {
	return (
		<Tool defaultOpen={part.state !== "output-available"}>
			<ToolHeader type={part.type} state={part.state} />
			<ToolContent>
				<ToolInput input={part.input} />
				<ToolOutput
					output={<Output output={part.output} />}
					errorText={part.errorText}
				/>
			</ToolContent>
		</Tool>
	);
};

const Output = ({
	output,
}: {
	output: SearchKnowledgeBaseToolPart["output"];
}) => {
	if (!output || !output.result || output.result.length === 0) {
		return null;
	}

	return (
		<div className="space-y-3 p-4">
			<p className="text-muted-foreground text-sm">
				Found {output.result.length} reference
				{output.result.length !== 1 ? "s" : ""}
			</p>
			<div className="flex flex-wrap gap-2">
				{output.result.map((result, index) => (
					<Popover key={result.id}>
						<PopoverTrigger asChild>
							<Button
								variant="outline"
								size="sm"
								className="group h-auto min-h-8 w-full gap-2 border-muted-foreground/20 px-3 py-2 transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-foreground hover:shadow-sm"
							>
								<FileTextIcon className="size-3 text-muted-foreground" />
								<span className="font-medium text-xs">
									Reference {index + 1}
								</span>
							</Button>
						</PopoverTrigger>
						<PopoverContent
							className="max-h-80 w-96 overflow-y-auto p-4"
							align="start"
							side="top"
						>
							<div className="space-y-3">
								<div className="flex items-center gap-2 border-b pb-2">
									<FileTextIcon className="size-4 text-primary" />
									<h4 className="font-semibold text-sm">
										Reference {index + 1}
									</h4>
									<Badge variant="outline" className="ml-auto text-[10px]">
										{result.id}
									</Badge>
								</div>
								<div className="prose prose-sm dark:prose-invert max-w-none">
									<Markdown className="text-xs leading-relaxed">
										{result.text}
									</Markdown>
								</div>
							</div>
						</PopoverContent>
					</Popover>
				))}
			</div>
		</div>
	);
};

export { SearchKnowledgeBaseTool };
