import { docsMarkdownPath } from "@orcai/core";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import { effectTool } from "@/lib/ai/tools/assistant/procedure-tool";
import { AssistantToolError } from "@/lib/ai/tools/tool-error";
import type { DocsConfig } from "@/lib/effect/services/config";

const FETCH_TIMEOUT = "10 seconds";
const DOCS_CONTENT_TYPES = new Set([
	"text/markdown",
	"text/plain",
]);

class ReadDocsError extends Data.TaggedError("ReadDocsError")<{
	message: string;
}> {}

const unavailable = () =>
	new ReadDocsError({
		message: "AI_TOOL_FAILED: The docs are unavailable right now.",
	});

/** The title of a page whose first line is `# <title> (<url>)`. */
export const docsPageTitle = (content: string) =>
	/^# (.+) \([^()\s]*\)$/.exec(content.split("\n", 1)[0] ?? "")?.[1] ?? null;

export type DocsFetch = (url: string, init: RequestInit) => Promise<Response>;

/** Reads the docs index, or one page when a path is given. */
export const readDocs = ({
	docs,
	path,
	fetch,
}: {
	docs: DocsConfig;
	path?: string;
	fetch: DocsFetch;
}) =>
	Effect.gen(function* () {
		const page = path === undefined ? undefined : docsMarkdownPath(path);

		if (path !== undefined && !page) {
			return yield* new ReadDocsError({
				message: `INVALID_TOOL_INPUT: ${path} is not a docs page path.`,
			});
		}

		const response = yield* Effect.tryPromise({
			try: (signal) =>
				fetch(`${docs.fetchOrigin}${page?.fetchPath ?? "/llms.txt"}`, {
					signal,
					redirect: "error",
				}),
			catch: unavailable,
		});

		if (response.status === 404 && page) {
			return yield* new ReadDocsError({
				message: `NOT_FOUND: No docs page at ${page.path}; read the index (call readDocs without a path) for valid paths.`,
			});
		}

		const contentType = response.headers
			.get("content-type")
			?.split(";")[0]
			?.trim()
			.toLowerCase();

		if (
			response.status !== 200 ||
			!contentType ||
			!DOCS_CONTENT_TYPES.has(contentType)
		) {
			return yield* unavailable();
		}

		const content = yield* Effect.tryPromise({
			try: () => response.text(),
			catch: unavailable,
		});

		return {
			path: page?.path ?? null,
			title: page ? docsPageTitle(content) : null,
			url: `${docs.publicOrigin}${page?.path ?? "/docs"}`,
			content,
		};
	}).pipe(
		Effect.timeoutOrElse({
			duration: FETCH_TIMEOUT,
			orElse: () => Effect.fail(unavailable()),
		}),
	);

export const readDocsTool = ({ docs }: { docs: DocsConfig | undefined }) =>
	effectTool({
		description:
			"Read the OrcAI docs: without a path the index of all pages with their descriptions, with a path one page as Markdown.",
		inputSchema: z.strictObject({
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
		}),
		run: ({ path }) =>
			(docs
				? readDocs({
						docs,
						path,
						fetch: globalThis.fetch,
					})
				: Effect.fail(unavailable())
			).pipe(Effect.mapError((error) => new AssistantToolError(error.message))),
	});
