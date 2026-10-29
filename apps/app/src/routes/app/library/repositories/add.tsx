import { createFileRoute } from "@tanstack/react-router";
import { DatabaseBlockForm } from "@/components/blocks/database-block/form/database-block-form";
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
				title: m.blocks_add_database_page_title(),
			},
		],
	}),
});

function RouteComponent() {
	return (
		<Page>
			<PageHeader>
				<PageTitle>{m.blocks_add_database_page_title()}</PageTitle>
				<PageDescription>
					{m.blocks_add_database_form_description()}
				</PageDescription>
			</PageHeader>
			<PageContent>
				<DatabaseBlockForm action="create" />
			</PageContent>
		</Page>
	);
}
