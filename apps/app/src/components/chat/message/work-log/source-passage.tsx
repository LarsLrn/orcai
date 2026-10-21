import { formatAssetTitle } from "@/components/chat/message/asset-title";
import { formatPageRange } from "@/lib/ai/tools/rag/format-page-range";
import type { Passage } from "@/lib/ai/tools/rag/types";
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
		<div className="rounded-lg border border-border bg-background px-3 py-1.5 shadow-xs">
			<div className="flex items-center gap-2">
				<span className="min-w-0 flex-1 truncate font-medium text-sm">
					{formatAssetTitle(passage.title) ?? m.chat_source_fallback_title()}
				</span>
				{pageRange && (
					<span className="shrink-0 text-muted-foreground text-xs">
						{m.chat_work_log_source_pages({
							range: pageRange,
						})}
					</span>
				)}
				{showBlockName && (
					<span className="hidden max-w-[40%] shrink-0 truncate text-muted-foreground text-xs sm:inline">
						{passage.blockName}
					</span>
				)}
			</div>
			<ClampedText className="mt-1 text-muted-foreground">
				{passage.text}
			</ClampedText>
		</div>
	);
};

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

export const spansMultipleBlocks = (blockNames: string[]) =>
	new Set(blockNames).size > 1;
