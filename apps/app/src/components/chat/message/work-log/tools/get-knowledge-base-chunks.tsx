import { chunksOutputSchema } from "@/lib/ai/tools/rag/outputs";
import type { ToolStatus } from "@/lib/ai/turn-view/turn-view";
import type { GetKnowledgeBaseChunksToolPart } from "@/lib/ai/types/tools";
import { m } from "@/paraglide/messages";
import { SourcePassages } from "../source-passage";
import { ToolEntry } from "../tool-entry";

export const GetKnowledgeBaseChunks = ({
	part,
	status,
}: {
	part: GetKnowledgeBaseChunksToolPart;
	status: ToolStatus | null;
}) => {
	const passages =
		chunksOutputSchema.safeParse(part.output).data?.passages ?? [];

	return (
		<ToolEntry
			part={part}
			status={status}
			label={
				passages.length > 0
					? m.chat_work_log_tool_get_chunks_result({
							count: passages.length,
						})
					: m.chat_work_log_tool_get_chunks_name()
			}
		>
			<SourcePassages passages={passages} />
		</ToolEntry>
	);
};
