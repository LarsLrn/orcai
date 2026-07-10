import { redirect } from "@tanstack/react-router";
import {
	createCsrfMiddleware,
	createMiddleware,
	createStart,
} from "@tanstack/react-start";
import { isMarkdownPreferred } from "fumadocs-core/negotiation";
import { siteConfig } from "@/lib/site-config";
import { slugsToMarkdownPath } from "./lib/source";

const csrfMiddleware = createCsrfMiddleware({
	filter: (ctx) => ctx.handlerType === "serverFn",
});

const llmMiddleware = createMiddleware().server(({ next, request }) => {
	const url = new URL(request.url);

	if (
		url.pathname.startsWith(siteConfig.docsPath) &&
		!url.pathname.endsWith(".md") &&
		isMarkdownPreferred(request)
	) {
		const slugs = url.pathname
			.slice(siteConfig.docsPath.length)
			.split("/")
			.filter((v) => v.length > 0);
		url.pathname = slugsToMarkdownPath(slugs).url;

		throw redirect(url);
	}

	return next();
});

export const startInstance = createStart(() => {
	return {
		requestMiddleware: [
			csrfMiddleware,
			llmMiddleware,
		],
	};
});
