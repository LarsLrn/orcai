import { formatAssetTitle } from "@/components/chat/message/asset-title";
import type { ToolStatus } from "@/lib/ai/turn-view/turn-view";
import type { ListKnowledgeBaseDocumentsToolPart } from "@/lib/ai/types/tools";
import { m } from "@/paraglide/messages";
import { SourcePassageList, spansMultipleBlocks } from "../source-passage";
import { ToolEntry } from "../tool-entry";

export const ListKnowledgeBaseDocuments = ({
	part,
	status,
}: {
	part: ListKnowledgeBaseDocumentsToolPart;
	status: ToolStatus | null;
}) => {
	const documents = part.output?.documents ?? [];
	const showBlockName = spansMultipleBlocks(
		documents.map((document) => document.block.name),
	);

	return (
		<ToolEntry
			part={part}
			status={status}
			label={
				documents.length > 0
					? m.chat_work_log_tool_list_documents_result({
							count: documents.length,
						})
					: m.chat_work_log_tool_list_documents_name()
			}
		>
			{documents.length > 0 && (
				<SourcePassageList>
					{documents.map((document) => (
						<div
							key={`${document.block.id}:${document.assetId}`}
							className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 shadow-xs"
						>
							<span className="min-w-0 flex-1 truncate font-medium text-sm">
								{formatAssetTitle(document.title) ??
									m.chat_source_fallback_title()}
							</span>
							{showBlockName && (
								<span className="hidden max-w-[40%] shrink-0 truncate text-muted-foreground text-xs sm:inline">
									{document.block.name}
								</span>
							)}
						</div>
					))}
				</SourcePassageList>
			)}
		</ToolEntry>
	);
};
