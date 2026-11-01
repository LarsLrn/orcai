import { safeExternalUrl } from "@orcai/core";
import { ExternalLinkIcon } from "lucide-react";
import { ConfirmedLink } from "@/components/chat/link-confirm";
import { ClampedText } from "./clamped-text";
import { SourcePassageList } from "./source-passage";

export interface WebSource {
	url: string;
	title?: string;
	content?: string;
}

export const hostOf = (url: string) => {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return url;
	}
};

const WebSourceRow = ({ source }: { source: WebSource }) => {
	const title = source.title || hostOf(source.url);

	return (
		<div className="rounded-lg border border-border bg-background px-3 py-1.5 shadow-xs">
			<div className="flex items-center gap-2">
				{safeExternalUrl(source.url) ? (
					<ConfirmedLink
						href={source.url}
						className="flex min-w-0 flex-1 items-center gap-1.5 text-left font-medium text-sm hover:underline"
					>
						<span className="truncate">{title}</span>
						<ExternalLinkIcon className="size-3 shrink-0 text-muted-foreground" />
					</ConfirmedLink>
				) : (
					<span className="min-w-0 flex-1 truncate font-medium text-sm">
						{title}
					</span>
				)}
				<span className="hidden max-w-[40%] shrink-0 truncate text-muted-foreground text-xs sm:inline">
					{hostOf(source.url)}
				</span>
			</div>
			{source.content && (
				<ClampedText className="mt-1 text-muted-foreground">
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
