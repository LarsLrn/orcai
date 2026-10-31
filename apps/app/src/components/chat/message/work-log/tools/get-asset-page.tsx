import { pageOutputSchema } from "@/lib/ai/tools/rag/outputs";
import type { ToolStatus } from "@/lib/ai/turn-view/turn-view";
import type { GetAssetPageToolPart } from "@/lib/ai/types/tools";
import { m } from "@/paraglide/messages";
import { SourcePassages } from "../source-passage";
import { ToolEntry } from "../tool-entry";

const pageLabel = (input: GetAssetPageToolPart["input"]) => {
	const page = input?.page;

	if (page === undefined) {
		return m.chat_work_log_tool_get_page_name();
	}

	const around = input?.includeAdjacentPages ?? 0;

	return around === 0
		? m.chat_work_log_tool_get_page_single({
				page,
			})
		: m.chat_work_log_tool_get_page_range({
				from: Math.max(1, page - around),
				to: page + around,
			});
};

export const GetAssetPage = ({
	part,
	status,
}: {
	part: GetAssetPageToolPart;
	status: ToolStatus | null;
}) => (
	<ToolEntry part={part} status={status} label={pageLabel(part.input)}>
		<SourcePassages
			passages={pageOutputSchema.safeParse(part.output).data?.passages ?? []}
		/>
	</ToolEntry>
);
