import type { GetKnowledgeBaseChunksToolPart } from "@/lib/ai/types/tools";
import { m } from "@/paraglide/messages";
import {
	SourcePassage,
	SourcePassageList,
	spansMultipleBlocks,
} from "../source-passage";
import { ToolEntry } from "../tool-entry";

export const GetKnowledgeBaseChunks = ({
	part,
	running,
}: {
	part: GetKnowledgeBaseChunksToolPart;
	running: boolean;
}) => {
	const chunks = part.output?.chunks ?? [];
	const showBlockName = spansMultipleBlocks(
		chunks.map((chunk) => chunk.source.block.name),
	);

	return (
		<ToolEntry
			part={part}
			running={running}
			label={
				chunks.length > 0
					? m.chat_work_log_tool_get_chunks_result({
							count: chunks.length,
						})
					: m.chat_work_log_tool_get_chunks_name()
			}
		>
			{chunks.length > 0 && (
				<SourcePassageList>
					{chunks.map((chunk) => (
						<SourcePassage
							key={chunk.id}
							title={chunk.source.document.title}
							blockName={chunk.source.block.name}
							showBlockName={showBlockName}
							pageStart={chunk.source.chunk.pageStart}
							pageEnd={chunk.source.chunk.pageEnd}
							totalPages={chunk.source.document.totalPages}
							text={chunk.text}
						/>
					))}
				</SourcePassageList>
			)}
		</ToolEntry>
	);
};
