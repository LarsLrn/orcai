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
import { formatPageRange } from "@/lib/ai/tools/rag/format-page-range";
import type { GetKnowledgeBasePageToolPart } from "@/lib/ai/types/tools";

const GetKnowledgeBasePage = ({
	part,
}: {
	part: GetKnowledgeBasePageToolPart;
}) => {
	return (
		<Tool defaultOpen={false}>
			<ToolHeader
				type={part.type}
				state={part.state}
				title="RAG Page Retrieval"
			/>
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
	output: GetKnowledgeBasePageToolPart["output"];
}) => {
	if (!output?.chunks || output.chunks.length === 0) {
		return null;
	}

	return (
		<div className="space-y-3 p-4">
			<div className="flex flex-wrap items-center gap-2">
				<p className="text-muted-foreground text-sm">
					Fetched {output.chunks.length} chunk
					{output.chunks.length !== 1 ? "s" : ""}
				</p>
				{output.stats && (
					<Badge variant="secondary" className="text-[10px]">
						p.{output.stats.pageFrom}
						{output.stats.pageTo !== output.stats.pageFrom
							? `–${output.stats.pageTo}`
							: ""}
					</Badge>
				)}
			</div>
			<div className="space-y-3">
				{output.chunks.map((result, index) => {
					const pageRange = formatPageRange({
						chunkPageStart: result.source.chunk.pageStart,
						chunkPageEnd: result.source.chunk.pageEnd,
						documentTotalPages: result.source.document.totalPages,
					});

					return (
						<div key={result.id} className="space-y-2 rounded-md border p-3">
							<div className="flex flex-wrap items-center gap-2">
								<FileTextIcon className="size-3 text-muted-foreground" />
								<span className="font-medium text-xs">Chunk {index + 1}</span>
								{pageRange && (
									<Badge variant="secondary" className="text-[10px]">
										p. {pageRange}
									</Badge>
								)}
								<Badge variant="outline" className="text-[10px]">
									{result.id}
								</Badge>
								<Badge variant="outline" className="text-[10px]">
									{result.source.block.name}
								</Badge>
							</div>
							<Markdown className="text-xs leading-relaxed">
								{result.text}
							</Markdown>
						</div>
					);
				})}
			</div>
		</div>
	);
};

export { GetKnowledgeBasePage };
