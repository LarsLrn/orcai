import { useSuspenseQueries } from "@tanstack/react-query";
import type { LinkProps } from "@tanstack/react-router";
import { Link, useRouteContext } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/button";
import {
	Panel,
	PanelHeader,
	PanelRows,
	PanelTitle,
	panelRowVariants,
} from "@/components/ui/composed/panel";
import { orpc } from "@/lib/orpc/orpc";
import { formatCount } from "@/lib/presentation/format-count";

const COUNT_INPUT = {
	pageIndex: 0,
	pageSize: 1,
} as const;

/** Who is in the organisation, and who has been asked to join. */
const ManagePeoplePanel = () => {
	const { auth } = useRouteContext({
		from: "/app",
	});
	const organizationId = auth.session.activeOrganizationId;

	const [members, groups, invitations] = useSuspenseQueries({
		queries: [
			orpc.organizationMember.list.queryOptions({
				input: {
					...COUNT_INPUT,
					organizationId,
				},
			}),
			orpc.group.list.queryOptions({
				input: COUNT_INPUT,
			}),
			orpc.organizationInvitation.list.queryOptions({
				input: {
					...COUNT_INPUT,
					organizationId,
					filters: {
						status: "pending",
					},
				},
			}),
		],
	});

	const rows: Array<{
		label: string;
		meta: string;
		count: number;
		linkProps: LinkProps;
	}> = [
		{
			label: "Members",
			meta: "People who can sign in to this organisation",
			count: members.data.rowCount,
			linkProps: {
				to: "/app/users",
			},
		},
		{
			label: "Groups",
			meta: "How access is granted to more than one person",
			count: groups.data.rowCount,
			linkProps: {
				to: "/app/groups",
			},
		},
		{
			label: "Pending invitations",
			meta: "Sent, not yet accepted",
			count: invitations.data.rowCount,
			linkProps: {
				to: "/app/users/invites",
			},
		},
	];

	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>People</PanelTitle>
				<Link
					to="/app/users/add"
					className={buttonVariants({
						variant: "ghost",
						size: "sm",
					})}
				>
					Invite people
				</Link>
			</PanelHeader>
			<PanelRows>
				{rows.map((row) => (
					<Link
						key={row.label}
						{...row.linkProps}
						className={panelRowVariants({
							variant: "link",
						})}
					>
						<div className="flex min-w-0 flex-col gap-1">
							<span className="truncate font-medium">{row.label}</span>
							<p className="truncate text-muted-foreground text-xs">
								{row.meta}
							</p>
						</div>
						<span className="shrink-0 font-medium text-base tabular-nums">
							{formatCount(row.count)}
						</span>
					</Link>
				))}
			</PanelRows>
		</Panel>
	);
};

export { ManagePeoplePanel };
