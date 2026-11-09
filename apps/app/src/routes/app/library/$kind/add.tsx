import type { BlockType } from "@orcai/schema";
import { createFileRoute } from "@tanstack/react-router";
import { BehaviourForm } from "@/components/blocks/behaviour/form/behaviour-form";
import { RepositoryForm } from "@/components/blocks/repository/form/repository-form";
import {
	Page,
	PageContent,
	PageDescription,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { ensureOrganizationCapability } from "@/lib/router/route-guards";
import { m } from "@/paraglide/messages";

const PAGES = {
	behaviour: {
		title: m.blocks_add_behaviour_page_title,
		description: m.blocks_add_behaviour_form_description,
		Form: BehaviourForm,
	},
	repository: {
		title: m.blocks_add_repository_page_title,
		description: m.blocks_add_repository_form_description,
		Form: RepositoryForm,
	},
} satisfies Record<BlockType, object>;

export const Route = createFileRoute("/app/library/$kind/add")({
	beforeLoad: async ({ context: { queryClient } }) => {
		await ensureOrganizationCapability({
			queryClient,
			permission: "create_block",
		});
	},
	component: RouteComponent,
	head: ({ params }) => ({
		meta: [
			{
				title: PAGES[params.kind].title(),
			},
		],
	}),
});

function RouteComponent() {
	const { title, description, Form } = PAGES[Route.useParams().kind];
	return (
		<Page>
			<PageHeader>
				<PageTitle>{title()}</PageTitle>
				<PageDescription>{description()}</PageDescription>
			</PageHeader>
			<PageContent>
				<Form action="create" />
			</PageContent>
		</Page>
	);
}
