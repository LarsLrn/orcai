import { createFileRoute } from "@tanstack/react-router";
import { getLLMText, markdownPathToSlugs, source } from "@/lib/source";

export const Route = createFileRoute("/docs/{$}.md")({
	server: {
		handlers: {
			GET: async ({ params }) => {
				const slugs = markdownPathToSlugs(params._splat?.split("/") ?? []);
				const page = source.getPage(slugs);
				if (!page) {
					return new Response("Not found", {
						status: 404,
						headers: {
							"Content-Type": "text/plain; charset=utf-8",
						},
					});
				}

				return new Response(await getLLMText(page), {
					headers: {
						"Content-Type": "text/markdown; charset=utf-8",
					},
				});
			},
		},
	},
});
