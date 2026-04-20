import { useSuspenseQuery } from "@tanstack/react-query";
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
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/hub/bots/$botId/setup")({
	validateSearch: z.object({
		step: z.coerce.number().int().min(0).max(4).catch(0).default(0),
		zedToken: z.string().optional(),
	}),
	loaderDeps: ({ search: { zedToken } }) => ({
		zedToken,
	}),
	loader: async ({ context: { queryClient }, params: { botId }, deps }) => {
		await queryClient.ensureQueryData(
			orpc.bot.findEditor.queryOptions({
				input: {
					id: botId,
					zedToken: deps.zedToken,
				},
			}),
		);
	},
	component: RouteComponent,
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
	const { data: editor } = useSuspenseQuery(
		orpc.bot.findEditor.queryOptions({
			input: {
				id: botId,
				zedToken: search.zedToken,
			},
		}),
	);

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
					editorData={editor.data}
					stepIndex={search.step}
					onStepChange={(step) =>
						navigate({
							search: {
								step,
								zedToken: search.zedToken,
							},
							replace: true,
						})
					}
				/>
			</PageContent>
		</Page>
	);
}
