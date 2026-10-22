import { GlobeIcon } from "lucide-react";
import { hostOf } from "@/components/chat/message/work-log/web-source";
import { badgeVariants } from "@/components/ui/badge";
import type { CitedWebSource } from "@/lib/ai/tools/web/sources";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

/** The web pages an answer cites, each a link to the page. */
export const MessageSources = ({ sources }: { sources: CitedWebSource[] }) =>
	sources.length > 0 && (
		<section
			aria-label={m.chat_web_sources_label()}
			className="not-prose flex flex-wrap items-center gap-1.5"
		>
			<span className="flex items-center gap-1 text-muted-foreground text-xs">
				<GlobeIcon className="size-3" />
				{m.chat_web_sources_label()}
			</span>
			{sources.map((source) => (
				<a
					key={source.url}
					href={source.url}
					target="_blank"
					rel="noopener noreferrer"
					title={source.title ?? source.url}
					className={cn(
						badgeVariants({
							variant: "secondary",
						}),
						"min-w-0 max-w-48 rounded-full border-transparent bg-accent-brand/10 font-medium text-accent-brand text-xs transition-colors duration-150 hover:bg-accent-brand/20",
					)}
				>
					<span className="truncate">{source.title || hostOf(source.url)}</span>
				</a>
			))}
		</section>
	);
