import { join } from "node:path";
import { Glob, plugin } from "bun";
import { createMdxPlugin } from "fumadocs-mdx/bun";
import { server } from "fumadocs-mdx/runtime/server";
import type { InternalTypeConfig } from "fumadocs-mdx/runtime/types";
import type * as Config from "../source.config";

/**
 * The docs site's `/llms.txt` and `/docs/<path>.md` responses for this
 * checkout, without running the site: Bun compiles the pages with the
 * site's fumadocs-mdx config, and the site's own source and LLM text build
 * the answers. The prompt evals read the docs through it.
 */

const WEB = join(import.meta.dir, "..");
const CONTENT = join(WEB, "content/docs");

await plugin(
	createMdxPlugin({
		configPath: join(WEB, "source.config.ts"),
		outDir: join(WEB, ".source"),
	}),
);

/** What Vite's eager `import.meta.glob` gives `.source/server.ts`. */
const glob = async (
	pattern: string,
	pick: (module: Record<string, unknown>) => unknown,
) =>
	Object.fromEntries(
		await Promise.all(
			Array.from(new Glob(pattern).scanSync(CONTENT), async (file) => [
				`./${file}`,
				pick(await import(`${join(CONTENT, file)}?collection=docs`)),
			]),
		),
	);

const docs = await server<typeof Config, InternalTypeConfig>().docs(
	"docs",
	"content/docs",
	await glob("**/*.json", (module) => module.default),
	await glob("**/*.mdx", (module) => module),
);

plugin({
	name: "docs-collections",
	setup: (build) => {
		build.module("collections/server", () => ({
			exports: {
				docs,
			},
			loader: "object",
		}));
	},
});

// Loaded once `collections/server` resolves to the pages above.
const { getLLMText, markdownPathToSlugs, source } = await import(
	"../src/lib/source"
);
const { llms } = await import("fumadocs-core/source");

const text = (body: string, contentType: string, status = 200) =>
	new Response(body, {
		status,
		headers: {
			"Content-Type": `${contentType}; charset=utf-8`,
		},
	});

/** Answers as the site's `llms[.]txt` and `docs/{$}[.]md` routes do. */
export const docsFetch = async (url: string) => {
	const { pathname } = new URL(url);
	if (pathname === "/llms.txt") {
		return text(llms(source).index(), "text/plain");
	}
	const page = pathname.startsWith("/docs/")
		? source.getPage(
				markdownPathToSlugs(pathname.slice("/docs/".length).split("/")),
			)
		: undefined;
	return page
		? text(await getLLMText(page), "text/markdown")
		: text("Not found", "text/plain", 404);
};
