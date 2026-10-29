import { createFileRoute } from "@tanstack/react-router";
import { TemplateBlockForm } from "@/components/blocks/template-block/form/template-block-form";
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
				title: m.blocks_add_template_page_title(),
			},
		],
	}),
});

function RouteComponent() {
	return (
		<Page>
			<PageHeader>
				<PageTitle>{m.blocks_add_template_page_title()}</PageTitle>
				<PageDescription>
					{m.blocks_add_template_form_description()}
				</PageDescription>
			</PageHeader>
			<PageContent>
				<TemplateBlockForm action="create" />
			</PageContent>
		</Page>
	);
}
