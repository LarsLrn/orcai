import { createFileRoute } from "@tanstack/react-router";
import z from "zod/v4";
import { BotEditorShell } from "@/components/authoring/bot-editor-shell";
import {
	Page,
	PageContent,
	PageDescription,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";

export const Route = createFileRoute("/app/hub/bots/$botId/setup")({
	component: RouteComponent,
	validateSearch: z.object({
		step: z.coerce.number().int().min(0).max(4).catch(0).default(0),
	}),
	head: () => ({
		meta: [
			{
				title: "Bot Setup",
			},
		],
	}),
});

function RouteComponent() {
	const { botId } = Route.useParams();
	const search = Route.useSearch();
	const navigate = Route.useNavigate();

	return (
		<Page>
			<PageHeader>
				<PageTitle>Bot Setup</PageTitle>
				<PageDescription>
					Use the shared authoring flow to update the bot configuration, reuse
					existing blocks, and publish changes when they are ready.
				</PageDescription>
			</PageHeader>
			<PageContent>
				<BotEditorShell
					botId={botId}
					stepIndex={search.step}
					onStepChange={(step) =>
						navigate({
							search: {
								step,
							},
							replace: true,
						})
					}
				/>
			</PageContent>
		</Page>
	);
}
