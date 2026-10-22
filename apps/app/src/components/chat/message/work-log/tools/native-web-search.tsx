import { z } from "zod/v4";
import type { ToolStatus } from "@/lib/ai/turn-view/turn-view";
import type { NativeWebSearchToolPart } from "@/lib/ai/types/tools";
import { m } from "@/paraglide/messages";
import { ToolEntry } from "../tool-entry";
import { type WebSource, WebSources } from "../web-source";

const queryOf = z.union([
	z
		.object({
			query: z.string(),
		})
		.transform(({ query }) => query),
	z
		.object({
			action: z.object({
				query: z.string(),
			}),
		})
		.transform(({ action }) => action.query),
]);

const pageSchema = z
	.object({
		url: z.string(),
		title: z.string().nullish(),
	})
	.transform(
		({ url, title }): WebSource => ({
			url,
			title: title ?? undefined,
		}),
	);

const pagesOf = z.union([
	z.array(pageSchema),
	z
		.object({
			sources: z.array(pageSchema),
		})
		.transform(({ sources }) => sources),
]);

/** Anthropic names the query in the input and lists pages; OpenAI names it in the output with its sources. */
export const NativeWebSearch = ({
	part,
	status,
}: {
	part: NativeWebSearchToolPart;
	status: ToolStatus | null;
}) => {
	const query =
		queryOf.safeParse(part.input).data ?? queryOf.safeParse(part.output).data;
	const pages = pagesOf.safeParse(part.output).data ?? [];

	return (
		<ToolEntry
			part={part}
			status={status}
			label={
				query
					? m.chat_work_log_tool_web_search_query({
							query,
							count: pages.length,
						})
					: m.chat_work_log_tool_web_search_name()
			}
		>
			<WebSources sources={pages} />
		</ToolEntry>
	);
};
