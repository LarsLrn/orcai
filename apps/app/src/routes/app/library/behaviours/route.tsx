import { createFileRoute } from "@tanstack/react-router";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/library/behaviours")({
	head: () => ({
		meta: [
			{
				title: m.behaviour_page_title(),
			},
		],
	}),
});
