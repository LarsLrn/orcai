import { createFileRoute } from "@tanstack/react-router";
import { LoadingPage } from "@/components/app/loading/loading-page";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/library/assets")({
	head: () => ({
		meta: [
			{
				title: m.assets_page_title(),
			},
		],
	}),
	pendingComponent: LoadingPage,
});
