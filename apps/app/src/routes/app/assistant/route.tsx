import { createFileRoute } from "@tanstack/react-router";
import { LoadingPage } from "@/components/app/loading/loading-page";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/assistant")({
	head: () => ({
		meta: [
			{
				title: m.assistant_name(),
			},
		],
	}),
	pendingComponent: LoadingPage,
});
