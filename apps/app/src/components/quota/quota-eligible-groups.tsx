import type { QuotaPoolDetail } from "@orcai/schema";
import { Link } from "@tanstack/react-router";
import { UsersIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
	Item,
	ItemActions,
	ItemContent,
	ItemDescription,
	ItemGroup,
	ItemMedia,
	ItemTitle,
} from "@/components/ui/item";
import { m } from "@/paraglide/messages";

/** The groups whose members can draw on a quota pool. */
const QuotaEligibleGroups = ({
	assignments,
}: {
	assignments: QuotaPoolDetail["assignments"];
}) =>
	assignments.length === 0 ? (
		<p className="text-muted-foreground text-sm">
			{m.quotas_detail_no_groups_label()}
		</p>
	) : (
		<ItemGroup className="gap-2">
			{assignments.map(({ id, group }) => (
				<Item
					key={id}
					variant="outline"
					size="sm"
					render={
						<Link
							to="/app/groups/$groupId"
							params={{
								groupId: group.id,
							}}
						/>
					}
				>
					<ItemMedia variant="icon">
						<UsersIcon />
					</ItemMedia>
					<ItemContent className="min-w-0">
						<ItemTitle>
							{group.name}
							<Badge
								variant={group.kind === "system" ? "outline" : "secondary"}
							>
								{group.kind === "system"
									? m.groups_kind_system()
									: m.groups_kind_custom()}
							</Badge>
						</ItemTitle>
						{group.description ? (
							<ItemDescription>{group.description}</ItemDescription>
						) : null}
					</ItemContent>
					<ItemActions className="text-muted-foreground tabular-nums">
						{m.quotas_detail_group_member_count({
							count: group.memberCount,
						})}
					</ItemActions>
				</Item>
			))}
		</ItemGroup>
	);

export { QuotaEligibleGroups };
