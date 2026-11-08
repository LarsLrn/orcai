import { docsMarkdownPath } from "@orcai/core";
import { BookOpenIcon } from "lucide-react";
import { z } from "zod/v4";
import { declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import { docsSources } from "./outputs";
import type { readDocsTool } from "./read-docs";

export const readDocsInputSchema = z.strictObject({
	path: z
		.string()
		.refine((path) => docsMarkdownPath(path) !== undefined, {
			message:
				"Use a docs page path from the docs index, such as /docs/using-orcai/bots.",
		})
		.optional()
		.describe(
			"A docs page path exactly as listed in the docs index, for example `/docs/using-orcai/bots`. Omit it to read the index.",
		),
});

export const readDocs = declareTool<typeof readDocsTool>()({
	kind: "read",
	group: "core",
	inputSchema: readDocsInputSchema,
	icon: BookOpenIcon,
	name: m.chat_work_log_tool_read_docs_index,
	active: m.chat_work_log_tool_read_docs_active,
	line: ({ output }) => {
		if (output?.path == null) {
			return m.chat_work_log_tool_read_docs_index();
		}

		return output.title === null
			? m.assistant_tool_read_docs_summary_path({
					path: output.path,
				})
			: m.assistant_tool_read_docs_summary({
					title: m.assistant_tool_quoted_name({
						name: output.title,
					}),
					path: output.path,
				});
	},
	sources: docsSources,
});
