import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { RefreshCwIcon } from "lucide-react";
import { CheckList } from "@/components/health/check-list";
import {
	ConfigCard,
	ProcessesCard,
	QueuesCard,
	VersionsCard,
} from "@/components/instance/health/health-tables";
import { instanceCheckTitle } from "@/components/instance/health/instance-check-titles";
import { MailCard } from "@/components/instance/health/mail-card";
import { Button } from "@/components/ui/button";
import {
	Page,
	PageAction,
	PageContent,
	PageDescription,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { orpc } from "@/lib/orpc/orpc";
import { formatDisplayTimestamp } from "@/lib/presentation/format-timestamp";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

const healthQuery = () =>
	orpc.health.instance.queryOptions({
		input: {},
	});

export const Route = createFileRoute("/instance/health/")({
	loader: async ({ context: { queryClient } }) => {
		await queryClient.query(healthQuery());
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: m.instance_health_page_title(),
			},
		],
	}),
});

function RouteComponent() {
	const {
		data: { data: health },
		refetch,
		isFetching,
	} = useSuspenseQuery(healthQuery());

	return (
		<Page>
			<PageHeader>
				<PageTitle>{m.instance_health_page_title()}</PageTitle>
				<PageDescription>
					{m.instance_health_page_description({
						date: formatDisplayTimestamp(health.checkedAt),
					})}
				</PageDescription>
				<PageAction>
					<Button
						variant="outline"
						disabled={isFetching}
						onClick={() => void refetch()}
					>
						<RefreshCwIcon className={cn(isFetching && "animate-spin")} />
						{m.instance_health_refresh_button()}
					</Button>
				</PageAction>
			</PageHeader>
			<PageContent className="space-y-6">
				<CheckList checks={health.checks} title={instanceCheckTitle} />
				<MailCard mail={health.mail} />
				<ProcessesCard processes={health.processes} />
				<QueuesCard queues={health.queues} />
				<VersionsCard versions={health.versions} />
				<ConfigCard config={health.config} />
			</PageContent>
		</Page>
	);
}
