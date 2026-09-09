import type { SearchKnowledgeBaseToolPart } from "@/lib/ai/types/tools";
import {
	SourcePassage,
	SourcePassageList,
	spansMultipleBlocks,
} from "../source-passage";
import { ToolEntry } from "../tool-entry";

const count = (n: number) => `${n} ${n === 1 ? "passage" : "passages"}`;

export const SearchKnowledgeBase = ({
	part,
	running,
}: {
	part: SearchKnowledgeBaseToolPart;
	running: boolean;
}) => {
	const results = part.output?.results ?? [];
	const showBlockName = spansMultipleBlocks(
		results.map((result) => result.source.block.name),
	);

	return (
		<ToolEntry
			part={part}
			running={running}
			label={
				results.length > 0
					? `Searched the sources, found ${count(results.length)}`
					: "Searched the sources"
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
