import { safeExternalUrl } from "@orcai/core";
import { ExternalLinkIcon } from "lucide-react";
import { ConfirmedLink } from "@/components/ui/composed/link-confirm";
import { hostOf } from "@/components/ui/composed/link-safety";
import { ClampedText } from "./clamped-text";
import { SourcePassageList } from "./source-passage";

export interface WebSource {
	url: string;
	title?: string;
	content?: string;
}

const WebSourceRow = ({ source }: { source: WebSource }) => {
	const title = source.title || hostOf(source.url);

	return (
		<div className="border-border bg-background rounded-lg border px-3 py-1.5 shadow-xs">
			<div className="flex items-center gap-2">
				{safeExternalUrl(source.url) ? (
					<ConfirmedLink
						href={source.url}
						className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-sm font-medium hover:underline"
					>
						<span className="truncate">{title}</span>
						<ExternalLinkIcon className="text-muted-foreground size-3 shrink-0" />
					</ConfirmedLink>
				) : (
					<span className="min-w-0 flex-1 truncate text-sm font-medium">
						{title}
					</span>
				)}
				<span className="text-muted-foreground hidden max-w-[40%] shrink-0 truncate text-xs sm:inline">
					{hostOf(source.url)}
				</span>
			</div>
			{source.content && (
				<ClampedText className="text-muted-foreground mt-1">
					{source.content}
				</ClampedText>
			)}
		</div>
	);
};

/** Pages a web search returned, each a link to the page that asks before it opens. */
export const WebSources = ({ sources }: { sources: WebSource[] }) =>
	sources.length > 0 && (
		<SourcePassageList>
			{sources.map((source) => (
				<WebSourceRow key={source.url} source={source} />
			))}
		</SourcePassageList>
	);
