import { zedTokenSchema } from "@orcai/schema";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import z from "zod/v4";
import { BotEditorShell } from "@/components/authoring/bot-editor-shell";
import { WIZARD_STEPS } from "@/components/authoring/bot-editor-steps";
import {
	Page,
	PageContent,
	PageDescription,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { ensureEntityCapability } from "@/lib/authz/route-guards";
import { orpc } from "@/lib/orpc/orpc";
import { orNotFound } from "@/lib/router/not-found";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/hub/bots/$botId/setup")({
	validateSearch: z.object({
		step: z.coerce
			.number()
			.int()
			.min(0)
			.max(WIZARD_STEPS.length - 1)
			.catch(0)
			.default(0),
		...zedTokenSchema.shape,
	}),
	loaderDeps: ({ search: { zedToken } }) => ({
		zedToken,
	}),
	loader: async ({ context: { queryClient }, params: { botId }, deps }) => {
		await ensureEntityCapability({
			queryClient,
			entityType: "bot",
			entityId: botId,
			permission: "edit",
			redirectTo: "/app/hub/bots",
		});
		await orNotFound(
			queryClient.query(
				orpc.bot.findEditor.queryOptions({
					input: {
						id: botId,
						zedToken: deps.zedToken,
					},
					staleTime: "static",
				}),
			),
		);
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: m.bots_setup_page_title(),
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
				<PageTitle>{m.bots_setup_page_title()}</PageTitle>
				<PageDescription>{m.bots_setup_page_description()}</PageDescription>
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
							ignoreBlocker: true,
						})
					}
				/>
			</PageContent>
		</Page>
	);
}
