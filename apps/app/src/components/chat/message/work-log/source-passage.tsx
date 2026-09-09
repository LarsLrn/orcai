import { Markdown } from "@/components/app/markdown";
import { formatAssetTitle } from "@/components/chat/message/asset-title";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { formatPageRange } from "@/lib/ai/tools/rag/format-page-range";

export interface SourcePassageProps {
	title: string;
	blockName: string;
	/** Block names only disambiguate when a result set spans several blocks. */
	showBlockName?: boolean;
	pageStart?: number;
	pageEnd?: number;
	totalPages?: number;
	text: string;
}

export const SourcePassage = ({
	title,
	blockName,
	showBlockName = true,
	pageStart,
	pageEnd,
	totalPages,
	text,
}: SourcePassageProps) => {
	const displayTitle = formatAssetTitle(title);
	const pageRange = formatPageRange({
		chunkPageStart: pageStart,
		chunkPageEnd: pageEnd,
		documentTotalPages: totalPages,
	});

	return (
		<Popover>
			<PopoverTrigger
				render={
					<button
						type="button"
						className="flex w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-left shadow-xs transition-colors duration-150 hover:bg-muted/50"
					/>
				}
			>
				<span className="min-w-0 flex-1 truncate font-medium text-sm">
					{displayTitle}
				</span>
				{pageRange && (
					<span className="shrink-0 text-muted-foreground text-xs">
						p. {pageRange}
					</span>
				)}
				{showBlockName && (
					<span className="hidden max-w-[40%] shrink-0 truncate text-muted-foreground text-xs sm:inline">
						{blockName}
					</span>
				)}
			</PopoverTrigger>
			<PopoverContent
				className="max-h-80 w-96 max-w-[calc(100vw-2rem)] gap-3 overflow-y-auto"
				align="start"
				side="top"
			>
				<div className="space-y-1">
					<h4 className="font-medium text-sm leading-snug">{displayTitle}</h4>
					<p className="text-muted-foreground text-xs">
						{blockName}
						{pageRange ? ` · p. ${pageRange}` : ""}
					</p>
				</div>
				<Markdown className="text-sm leading-relaxed [&_h1]:text-base [&_h2]:text-base [&_h3]:text-sm [&_h4]:text-sm [&_h5]:text-sm [&_h6]:text-sm">
					{text}
				</Markdown>
			</PopoverContent>
		</Popover>
	);
};

export const SourcePassageList = ({
	children,
}: {
	children: React.ReactNode;
}) => <div className="mt-2 flex flex-col gap-1">{children}</div>;

export const spansMultipleBlocks = (blockNames: string[]) =>
	new Set(blockNames).size > 1;
