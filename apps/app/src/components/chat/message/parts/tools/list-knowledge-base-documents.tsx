import { BookOpenIcon } from "lucide-react";
import {
	Tool,
	ToolContent,
	ToolHeader,
	ToolInput,
	ToolOutput,
} from "@/components/ai-elements/tool";
import { Badge } from "@/components/ui/badge";
import type { ListKnowledgeBaseDocumentsToolPart } from "@/lib/ai/types/tools";

const ListKnowledgeBaseDocuments = ({
	part,
}: {
	part: ListKnowledgeBaseDocumentsToolPart;
}) => {
	return (
		<Tool defaultOpen={false}>
			<ToolHeader
				type={part.type}
				state={part.state}
				title="Knowledge Base Documents"
			/>
			<ToolContent>
				<ToolInput
					input={part.input}
					rawInput={"rawInput" in part ? part.rawInput : undefined}
					errorText={part.errorText}
				/>
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
	output: ListKnowledgeBaseDocumentsToolPart["output"];
}) => {
	if (!output?.documents || output.documents.length === 0) {
		return null;
	}

	return (
		<div className="space-y-3 p-4">
			<p className="text-muted-foreground text-sm">
				Found {output.documents.length} document
				{output.documents.length !== 1 ? "s" : ""}
				{output.stats ? ` (${output.stats.totalDocuments} total)` : ""}
			</p>
			<div className="space-y-2">
				{output.documents.map((doc) => (
					<div
						key={`${doc.block.id}:${doc.assetId}`}
						className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2"
					>
						<BookOpenIcon className="size-3 shrink-0 text-muted-foreground" />
						<span className="font-medium text-xs">{doc.title}</span>
						<Badge variant="secondary" className="text-[10px]">
							{doc.assetId}
						</Badge>
						<Badge variant="outline" className="ml-auto text-[10px]">
							{doc.block.name}
						</Badge>
					</div>
				))}
			</div>
		</div>
	);
};

export { ListKnowledgeBaseDocuments };
