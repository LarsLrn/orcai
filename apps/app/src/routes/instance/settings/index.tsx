import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { EmbeddingsSection } from "@/components/instance/settings/embeddings-section";
import { SearchIndexSection } from "@/components/instance/settings/search-index-section";
import { EmbeddingsRebuildAlert } from "@/components/preparation/embeddings-rebuild-notice";
import {
	Page,
	PageContent,
	PageDescription,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

const PROGRESS_POLL_MS = 5_000;

const settingsQuery = () =>
	orpc.instanceSettings.find.queryOptions({
		input: {},
	});

const progressQuery = () =>
	orpc.instanceSettings.embeddingProgress.queryOptions({
		input: {},
		refetchInterval: (query) => {
			const progress = query.state.data?.data;
			return progress?.rebuilding ||
				progress?.organizations.some((row) => row.waiting > 0)
				? PROGRESS_POLL_MS
				: false;
		},
	});

export const Route = createFileRoute("/instance/settings/")({
	loader: async ({ context: { queryClient } }) => {
		await Promise.all([
			queryClient.query(settingsQuery()),
			queryClient.query(progressQuery()),
		]);
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
	const {
		data: { data: progress },
	} = useSuspenseQuery(progressQuery());
	const files =
		progress?.organizations.reduce(
			(sum, row) => sum + row.embedded + row.waiting + row.failed,
			0,
		) ?? 0;

	return (
		<Page>
			<PageHeader className="mx-auto w-full max-w-3xl">
				<PageTitle>{m.instance_settings_page_title()}</PageTitle>
				<PageDescription>
					{m.instance_settings_page_description()}
				</PageDescription>
			</PageHeader>
			<PageContent className="mx-auto w-full max-w-3xl space-y-6">
				{progress?.rebuilding && <EmbeddingsRebuildAlert />}
				<EmbeddingsSection
					key={`${settings.embeddings?.baseUrl}/${settings.embeddings?.model}`}
					embeddings={settings.embeddings}
					files={files}
				/>
				{progress && <SearchIndexSection progress={progress} />}
			</PageContent>
		</Page>
	);
}
