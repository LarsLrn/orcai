import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { EmbeddingsSection } from "@/components/instance/settings/embeddings-section";
import {
	Page,
	PageContent,
	PageDescription,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

const settingsQuery = () =>
	orpc.instanceSettings.find.queryOptions({
		input: {},
	});

export const Route = createFileRoute("/instance/settings/")({
	loader: async ({ context: { queryClient } }) => {
		await queryClient.query(settingsQuery());
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: m.instance_settings_page_title(),
			},
		],
	}),
});

function RouteComponent() {
	const {
		data: { data: settings },
	} = useSuspenseQuery(settingsQuery());

	return (
		<Page>
			<PageHeader className="mx-auto w-full max-w-3xl">
				<PageTitle>{m.instance_settings_page_title()}</PageTitle>
				<PageDescription>
					{m.instance_settings_page_description()}
				</PageDescription>
			</PageHeader>
			<PageContent className="mx-auto w-full max-w-3xl space-y-6">
				<EmbeddingsSection
					key={`${settings.embeddings?.baseUrl}/${settings.embeddings?.model}`}
					embeddings={settings.embeddings}
				/>
			</PageContent>
		</Page>
	);
}
