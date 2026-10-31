import { searchOutputSchema } from "@/lib/ai/tools/rag/outputs";
import type { ToolStatus } from "@/lib/ai/turn-view/turn-view";
import type { SearchRepositoriesToolPart } from "@/lib/ai/types/tools";
import { m } from "@/paraglide/messages";
import { SourcePassages } from "../source-passage";
import { ToolEntry } from "../tool-entry";

export const SearchRepositories = ({
	part,
	status,
}: {
	part: SearchRepositoriesToolPart;
	status: ToolStatus | null;
}) => {
	const results = searchOutputSchema.safeParse(part.output).data?.results ?? [];

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
			<SourcePassages passages={results} />
		</ToolEntry>
	);
};
