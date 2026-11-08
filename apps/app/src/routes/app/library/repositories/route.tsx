import { createFileRoute } from "@tanstack/react-router";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/library/repositories")({
	head: () => ({
		meta: [
			{
				title: m.blocks_repositories_page_title(),
			},
		],
	}),
});
