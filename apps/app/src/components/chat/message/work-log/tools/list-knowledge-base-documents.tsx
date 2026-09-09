import { formatAssetTitle } from "@/components/chat/message/asset-title";
import type { ListKnowledgeBaseDocumentsToolPart } from "@/lib/ai/types/tools";
import { SourcePassageList, spansMultipleBlocks } from "../source-passage";
import { ToolEntry } from "../tool-entry";

const count = (n: number) => `${n} available ${n === 1 ? "source" : "sources"}`;

export const ListKnowledgeBaseDocuments = ({
	part,
	running,
}: {
	part: ListKnowledgeBaseDocumentsToolPart;
	running: boolean;
}) => {
	const documents = part.output?.documents ?? [];
	const showBlockName = spansMultipleBlocks(
		documents.map((document) => document.block.name),
	);

	return (
		<ToolEntry
			part={part}
			running={running}
			label={
				documents.length > 0
					? `Listed ${count(documents.length)}`
					: "Listed the available sources"
			}
		>
			{documents.length > 0 && (
				<SourcePassageList>
					{documents.map((document) => (
						<div
							key={`${document.block.id}:${document.assetId}`}
							className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 shadow-xs"
						>
							<span className="min-w-0 flex-1 truncate font-medium text-sm">
								{formatAssetTitle(document.title)}
							</span>
							{showBlockName && (
								<span className="hidden max-w-[40%] shrink-0 truncate text-muted-foreground text-xs sm:inline">
									{document.block.name}
								</span>
							)}
						</div>
					))}
				</SourcePassageList>
			)}
		</ToolEntry>
	);
};
