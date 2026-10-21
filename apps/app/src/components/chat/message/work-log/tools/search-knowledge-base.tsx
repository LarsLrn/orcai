import type { ToolStatus } from "@/lib/ai/turn-view/turn-view";
import type { SearchKnowledgeBaseToolPart } from "@/lib/ai/types/tools";
import { m } from "@/paraglide/messages";
import {
	SourcePassage,
	SourcePassageList,
	spansMultipleBlocks,
} from "../source-passage";
import { ToolEntry } from "../tool-entry";

export const SearchKnowledgeBase = ({
	part,
	status,
}: {
	part: SearchKnowledgeBaseToolPart;
	status: ToolStatus | null;
}) => {
	const results = part.output?.results ?? [];
	const showBlockName = spansMultipleBlocks(
		results.map((result) => result.source.block.name),
	);

	return (
		<ToolEntry
			part={part}
			status={status}
			label={
				results.length > 0
					? m.chat_work_log_tool_search_result({
							count: results.length,
						})
					: m.chat_work_log_tool_search_name()
			}
		>
			{results.length > 0 && (
				<SourcePassageList>
					{results.map((result) => (
						<SourcePassage
							key={result.id}
							title={result.source.document.title}
							blockName={result.source.block.name}
							showBlockName={showBlockName}
							pageStart={result.source.chunk.pageStart}
							pageEnd={result.source.chunk.pageEnd}
							totalPages={result.source.document.totalPages}
							text={result.snippet}
						/>
					))}
				</SourcePassageList>
			)}
		</ToolEntry>
	);
};
