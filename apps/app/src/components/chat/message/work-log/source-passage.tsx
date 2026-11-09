import { formatPageRange } from "@/lib/ai/tools/retrieval/format-page-range";
import type { Passage } from "@/lib/ai/tools/retrieval/types";
import { formatAssetTitle } from "@/lib/assets/asset-title";
import { m } from "@/paraglide/messages";
import { ClampedText } from "./clamped-text";

const SourcePassage = ({
	passage,
	showBlockName,
}: {
	passage: Passage;
	showBlockName: boolean;
}) => {
	const pageRange = formatPageRange({
		chunkPageStart: passage.pageStart,
		chunkPageEnd: passage.pageEnd,
		documentTotalPages: passage.totalPages,
	});

	return (
		<div className="border-border bg-background rounded-lg border px-3 py-1.5 shadow-xs">
			<div className="flex items-center gap-2">
				<span className="min-w-0 flex-1 truncate text-sm font-medium">
					{formatAssetTitle(passage.title) ?? m.chat_source_fallback_title()}
				</span>
				{pageRange && (
					<span className="text-muted-foreground shrink-0 text-xs">
						{m.chat_work_log_source_pages({
							range: pageRange,
						})}
					</span>
				)}
				{showBlockName && (
					<span className="text-muted-foreground hidden max-w-[40%] shrink-0 truncate text-xs sm:inline">
						{passage.blockName}
					</span>
				)}
			</div>
			<ClampedText className="text-muted-foreground mt-1">
				{passage.text}
			</ClampedText>
		</div>
	);
};

const spansMultipleBlocks = (blockNames: string[]) =>
	new Set(blockNames).size > 1;

/** Block names only disambiguate when the passages span several blocks. */
export const SourcePassages = ({ passages }: { passages: Passage[] }) => {
	const showBlockName = spansMultipleBlocks(
		passages.map(({ blockName }) => blockName),
	);

	return (
		passages.length > 0 && (
			<SourcePassageList>
				{passages.map((passage) => (
					<SourcePassage
						key={passage.id}
						passage={passage}
						showBlockName={showBlockName}
					/>
				))}
			</SourcePassageList>
		)
	);
};

export const SourcePassageList = ({
	children,
}: {
	children: React.ReactNode;
}) => <div className="mt-2 flex flex-col gap-1">{children}</div>;
