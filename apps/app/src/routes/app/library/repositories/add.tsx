import { createFileRoute } from "@tanstack/react-router";
import { RepositoryForm } from "@/components/blocks/repository/form/repository-form";
import {
	Page,
	PageContent,
	PageDescription,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { ensureOrganizationCapability } from "@/lib/authz/route-guards";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/library/repositories/add")({
	loader: async ({ context: { queryClient } }) => {
		await ensureOrganizationCapability({
			queryClient,
			permission: "create_block",
			redirectTo: "/app/library/repositories",
		});
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: m.blocks_add_repository_page_title(),
			},
		],
	}),
});

function RouteComponent() {
	return (
		<Page>
			<PageHeader>
				<PageTitle>{m.blocks_add_repository_page_title()}</PageTitle>
				<PageDescription>
					{m.blocks_add_repository_form_description()}
				</PageDescription>
			</PageHeader>
			<PageContent>
				<RepositoryForm action="create" />
			</PageContent>
		</Page>
	);
}
