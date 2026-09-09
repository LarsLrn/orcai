import type { GetKnowledgeBasePageToolPart } from "@/lib/ai/types/tools";
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
		return "Read a page";
	}

	return to === undefined || to === from
		? `Read page ${from}`
		: `Read pages ${from} to ${to}`;
};

export const GetKnowledgeBasePage = ({
	part,
	running,
}: {
	part: GetKnowledgeBasePageToolPart;
	running: boolean;
}) => {
	const chunks = part.output?.chunks ?? [];
	const showBlockName = spansMultipleBlocks(
		chunks.map((chunk) => chunk.source.block.name),
	);

	return (
		<ToolEntry part={part} running={running} label={pageLabel(part.output)}>
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
