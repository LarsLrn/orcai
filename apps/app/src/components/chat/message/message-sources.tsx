import { GlobeIcon } from "lucide-react";
import { ConfirmedLink } from "@/components/chat/link-confirm";
import { hostOf } from "@/components/chat/link-safety";
import { badgeVariants } from "@/components/ui/badge";
import type { CitedWebSource } from "@/lib/ai/tools/web-search/sources";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

/** The web pages an answer cites, each a link to the page that asks before it opens. */
export const MessageSources = ({ sources }: { sources: CitedWebSource[] }) =>
	sources.length > 0 && (
		<section
			aria-label={m.chat_web_sources_label()}
			className="not-prose flex flex-wrap items-center gap-1.5"
		>
			<span className="text-muted-foreground flex items-center gap-1 text-xs">
				<GlobeIcon className="size-3" />
				{m.chat_web_sources_label()}
			</span>
			{sources.map((source) => (
				<ConfirmedLink
					key={source.url}
					href={source.url}
					title={source.title ?? source.url}
					className={cn(
						badgeVariants({
							variant: "secondary",
						}),
						"bg-accent-brand/10 text-accent-brand hover:bg-accent-brand/20 max-w-48 min-w-0 rounded-full border-transparent text-xs font-medium transition-colors duration-150",
					)}
				>
					<span className="truncate">{source.title || hostOf(source.url)}</span>
				</ConfirmedLink>
			))}
		</section>
	);
