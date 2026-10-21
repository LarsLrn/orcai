import type { ToolStatus } from "@/lib/ai/turn-view/turn-view";
import type { GetKnowledgeBasePageToolPart } from "@/lib/ai/types/tools";
import { m } from "@/paraglide/messages";
import {
	SourcePassage,
	SourcePassageList,
	spansMultipleBlocks,
} from "../source-passage";
import { ToolEntry } from "../tool-entry";

const pageLabel = (output: GetKnowledgeBasePageToolPart["output"]) => {
	const from = output?.stats?.pageFrom;
	const to = output?.stats?.pageTo;

	if (from === undefined) {
		return m.chat_work_log_tool_get_page_name();
	}

	return to === undefined || to === from
		? m.chat_work_log_tool_get_page_single({
				page: from,
			})
		: m.chat_work_log_tool_get_page_range({
				from,
				to,
			});
};

export const GetKnowledgeBasePage = ({
	part,
	status,
}: {
	part: GetKnowledgeBasePageToolPart;
	status: ToolStatus | null;
}) => {
	const chunks = part.output?.passages ?? [];
	const showBlockName = spansMultipleBlocks(
		chunks.map((chunk) => chunk.source.block.name),
	);

	return (
		<ToolEntry part={part} status={status} label={pageLabel(part.output)}>
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
