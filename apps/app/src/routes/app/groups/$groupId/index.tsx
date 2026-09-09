import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { GroupMembersContent } from "@/components/groups/group-members-content";
import { GroupSettingsForm } from "@/components/groups/group-settings-form";
import { Badge } from "@/components/ui/badge";
import {
	Page,
	PageAction,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/groups/$groupId/")({
	component: RouteComponent,
});

function RouteComponent() {
	const { groupId } = Route.useParams();

	const group = useQuery(
		orpc.group.find.queryOptions({
			input: {
				id: groupId,
			},
		}),
	);

	if (!group.data?.data) {
		return (
			<Page>
				<PageContent className="py-10 text-center text-muted-foreground">
					Loading group...
				</PageContent>
			</Page>
		);
	}

	const groupData = group.data.data;
	const isSystemGroup = groupData.kind === "system";

	return (
		<Page>
			<PageHeader>
				<PageTitle>{groupData.name}</PageTitle>
				<PageAction>
					<Badge variant={isSystemGroup ? "outline" : "secondary"}>
						{isSystemGroup ? "System" : "Custom"}
					</Badge>
				</PageAction>
			</PageHeader>

			<PageContent className="space-y-4">
				<GroupSettingsForm key={groupData.id} group={groupData} />
				<GroupMembersContent group={groupData} />
			</PageContent>
		</Page>
	);
}
