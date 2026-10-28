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
import { ensureOrganizationCapability } from "@/lib/authz/route-guards";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/hub/bots/add")({
	validateSearch: z.object({
		step: z.coerce
			.number()
			.int()
			.min(0)
			.max(WIZARD_STEPS.length - 1)
			.catch(0)
			.default(0),
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
				title: m.bots_add_page_title(),
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
				<PageTitle>{m.bots_add_page_title()}</PageTitle>
				<PageDescription>{m.bots_add_page_description()}</PageDescription>
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
							ignoreBlocker: true,
						})
					}
				/>
			</PageContent>
		</Page>
	);
}
