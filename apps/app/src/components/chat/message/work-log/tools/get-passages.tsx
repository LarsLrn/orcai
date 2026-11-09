import type { GetPassagesToolPart } from "@/lib/ai/messages/tools";
import type { ToolStatus } from "@/lib/ai/messages/turn-view";
import { passagesOutputSchema } from "@/lib/ai/tools/retrieval/outputs";
import { m } from "@/paraglide/messages";
import { SourcePassages } from "../source-passage";
import { ToolEntry } from "../tool-entry";

export const GetPassages = ({
	part,
	status,
}: {
	part: GetPassagesToolPart;
	status: ToolStatus | null;
}) => {
	const passages =
		passagesOutputSchema.safeParse(part.output).data?.passages ?? [];

	return (
		<ToolEntry
			part={part}
			status={status}
			label={
				passages.length > 0
					? m.chat_work_log_tool_get_passages_result({
							count: passages.length,
						})
					: m.chat_work_log_tool_get_passages_name()
			}
		>
			<SourcePassages passages={passages} />
		</ToolEntry>
	);
};
