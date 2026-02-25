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
import type { GetKnowledgeBaseChunksToolPart } from "@/lib/ai/types/tools";

const GetKnowledgeBaseChunks = ({
	part,
}: {
	part: GetKnowledgeBaseChunksToolPart;
}) => {
	return (
		<Tool defaultOpen={false}>
			<ToolHeader
				type={part.type}
				state={part.state}
				title="RAG Chunk Retrieval"
			/>
			<ToolContent>
				<ToolInput input={part.input} />
				<ToolOutput
					output={Output({ output: part.output })}
					errorText={part.errorText}
				/>
			</ToolContent>
		</Tool>
	);
};

const Output = ({
	output,
}: {
	output: GetKnowledgeBaseChunksToolPart["output"];
}) => {
	if (!output?.result || output.result.length === 0) {
		return null;
	}

	return (
		<div className="space-y-3 p-4">
			<p className="text-muted-foreground text-sm">
				Fetched {output.result.length} full chunk
				{output.result.length !== 1 ? "s" : ""}
			</p>
			<div className="space-y-3">
				{output.result.map((result, index) => (
					<div key={result.id} className="space-y-2 rounded-md border p-3">
						<div className="flex flex-wrap items-center gap-2">
							<FileTextIcon className="size-3 text-muted-foreground" />
							<span className="font-medium text-xs">Chunk {index + 1}</span>
							<Badge variant="outline" className="text-[10px]">
								{result.id}
							</Badge>
							<Badge variant="secondary" className="text-[10px]">
								Score {result?.score?.toFixed(3)}
							</Badge>
							<Badge variant="outline" className="text-[10px]">
								{result.source.blockName}
							</Badge>
						</div>
						<Markdown className="text-xs leading-relaxed">
							{result.text}
						</Markdown>
					</div>
				))}
			</div>
		</div>
	);
};

export { GetKnowledgeBaseChunks };
