import { createFileRoute } from "@tanstack/react-router";
import { BehaviourForm } from "@/components/blocks/behaviour/form/behaviour-form";
import {
	Page,
	PageContent,
	PageDescription,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { ensureOrganizationCapability } from "@/lib/authz/route-guards";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/library/behaviours/add")({
	loader: async ({ context: { queryClient } }) => {
		await ensureOrganizationCapability({
			queryClient,
			permission: "create_block",
			redirectTo: "/app/library/behaviours",
		});
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: m.blocks_add_behaviour_page_title(),
			},
		],
	}),
});

function RouteComponent() {
	return (
		<Page>
			<PageHeader>
				<PageTitle>{m.blocks_add_behaviour_page_title()}</PageTitle>
				<PageDescription>
					{m.blocks_add_behaviour_form_description()}
				</PageDescription>
			</PageHeader>
			<PageContent>
				<BehaviourForm action="create" />
			</PageContent>
		</Page>
	);
}
