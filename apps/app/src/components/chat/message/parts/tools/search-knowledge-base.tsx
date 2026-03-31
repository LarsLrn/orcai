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
import type { SearchKnowledgeBaseToolPart } from "@/lib/ai/types/tools";

const SearchKnowledgeBase = ({
	part,
}: {
	part: SearchKnowledgeBaseToolPart;
}) => {
	return (
		<Tool defaultOpen={false}>
			<ToolHeader type={part.type} state={part.state} title="RAG Search" />
			<ToolContent>
				<ToolInput input={part.input} />
				<ToolOutput
					output={Output({
						output: part.output,
					})}
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
	if (!output?.result || output.result.length === 0) {
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
						<PopoverTrigger
							render={
								<Button
									variant="outline"
									size="sm"
									className="group/popover-trigger w-full"
								>
									<FileTextIcon className="size-3 text-muted-foreground group-hover/popover-trigger:text-accent-foreground" />
									<span className="font-medium text-xs">
										Reference {index + 1}
									</span>
								</Button>
							}
						/>
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
								<div className="flex flex-wrap gap-2">
									<Badge variant="secondary" className="text-[10px]">
										Score {result?.score?.toFixed(3)}
									</Badge>
									<Badge variant="outline" className="text-[10px]">
										Block {result.source.blockName}
									</Badge>
									<Badge variant="outline" className="text-[10px]">
										Chunk {result.source.chunkIndex + 1}/
										{result.source.chunkCount}
									</Badge>
								</div>
								<div className="prose prose-sm dark:prose-invert max-w-none">
									<Markdown className="text-xs leading-relaxed">
										{result.snippet}
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

export { SearchKnowledgeBase };
