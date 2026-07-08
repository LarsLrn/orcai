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
import { ensureOrganizationCapability } from "@/lib/authz/route-guards";

export const Route = createFileRoute("/app/hub/bots/add")({
	validateSearch: z.object({
		step: z.coerce.number().int().min(0).max(4).catch(0).default(0),
	}),
	loader: async ({ context: { queryClient } }) => {
		await ensureOrganizationCapability({
			queryClient,
			permission: "create_bot",
			redirectTo: "/app/hub/bots",
		});
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: "Create Bot",
			},
		],
	}),
});

function RouteComponent() {
	const search = Route.useSearch();
	const navigate = Route.useNavigate();

	return (
		<Page>
			<PageHeader>
				<PageTitle>Create Bot</PageTitle>
				<PageDescription>
					Follow the guided setup to define the bot, its AI behaviour, its
					content collections, and its access settings.
				</PageDescription>
			</PageHeader>
			<PageContent>
				<BotEditorShell
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
