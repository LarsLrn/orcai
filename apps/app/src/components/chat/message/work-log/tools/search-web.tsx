import { searchWebOutputSchema } from "@/lib/ai/tools/web/outputs";
import type { ToolStatus } from "@/lib/ai/turn-view/turn-view";
import type { SearchWebToolPart } from "@/lib/ai/types/tools";
import { m } from "@/paraglide/messages";
import { ToolEntry } from "../tool-entry";
import { WebSources } from "../web-source";

export const SearchWeb = ({
	part,
	status,
}: {
	part: SearchWebToolPart;
	status: ToolStatus | null;
}) => {
	const results =
		searchWebOutputSchema.safeParse(part.output).data?.results ?? [];
	const query = part.input?.query;

	return (
		<ToolEntry
			part={part}
			status={status}
			label={
				query
					? m.chat_work_log_tool_web_search_query({
							query,
							count: results.length,
						})
					: m.chat_work_log_tool_web_search_name()
			}
		>
			<WebSources sources={results} />
		</ToolEntry>
	);
};
