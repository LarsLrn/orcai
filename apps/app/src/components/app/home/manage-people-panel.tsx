import { useSuspenseQueries, useSuspenseQuery } from "@tanstack/react-query";
import type { LinkProps } from "@tanstack/react-router";
import { Link, useRouteContext } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/button";
import {
	Panel,
	PanelHeader,
	PanelRow,
	PanelRows,
	PanelTitle,
	panelRowVariants,
} from "@/components/ui/composed/panel";
import { useOrganizationCapabilities } from "@/hooks/authz/use-capabilities";
import { hasCapability } from "@/lib/authz/capabilities";
import { orpc } from "@/lib/orpc/orpc";
import { formatCount } from "@/lib/presentation/format-number";
import { m } from "@/paraglide/messages";

const COUNT_INPUT = {
	pageIndex: 0,
	pageSize: 1,
} as const;

type PeopleRowProps = {
	label: string;
	meta: string;
	count: number;
	linkProps: LinkProps;
	/** Whether the row opens its page; without the capability it only counts. */
	linked: boolean;
};

const PeopleRow = ({
	label,
	meta,
	count,
	linkProps,
	linked,
}: PeopleRowProps) => {
	const body = (
		<>
			<div className="flex min-w-0 flex-col gap-1">
				<span className="truncate font-medium">{label}</span>
				<p className="truncate text-muted-foreground text-xs">{meta}</p>
			</div>
			<span className="shrink-0 font-medium text-base tabular-nums">
				{formatCount(count)}
			</span>
		</>
	);

	return linked ? (
		<Link
			{...linkProps}
			className={panelRowVariants({
				variant: "link",
			})}
		>
			{body}
		</Link>
	) : (
		<PanelRow>{body}</PanelRow>
	);
};

const InvitationsRow = ({ linked }: Pick<PeopleRowProps, "linked">) => {
	const { data: invitations } = useSuspenseQuery(
		orpc.organizationInvitation.list.queryOptions({
			input: {
				...COUNT_INPUT,
				filters: {
					status: "pending",
				},
			},
		}),
	);

	return (
		<PeopleRow
			label={m.home_people_invitations_label()}
			meta={m.home_people_invitations_meta()}
			count={invitations.rowCount}
			linkProps={{
				to: "/app/members/invitations",
			}}
			linked={linked}
		/>
	);
};

/** Who is in the organisation, and who has been asked to join. */
const ManagePeoplePanel = () => {
	const { auth } = useRouteContext({
		from: "/app",
	});
	const { data: organizationCapabilities } = useOrganizationCapabilities();
	const capabilities = organizationCapabilities?.data.capabilities;

	const [organization, groups] = useSuspenseQueries({
		queries: [
			orpc.organization.find.queryOptions({
				input: {
					id: auth.session.activeOrganizationId,
				},
			}),
			orpc.group.list.queryOptions({
				input: COUNT_INPUT,
			}),
		],
	});

	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>{m.home_people_panel_title()}</PanelTitle>
				{hasCapability(capabilities, "manage_members") ? (
					<Link
						to="/app/members/add"
						className={buttonVariants({
							variant: "ghost",
							size: "sm",
						})}
					>
						{m.home_people_panel_invite_action()}
					</Link>
				) : null}
			</PanelHeader>
			<PanelRows>
				<PeopleRow
					label={m.home_people_members_label()}
					meta={m.home_people_members_meta()}
					count={organization.data.data.memberCount}
					linkProps={{
						to: "/app/members",
					}}
					linked={hasCapability(capabilities, "manage_members")}
				/>
				<PeopleRow
					label={m.home_people_groups_label()}
					meta={m.home_people_groups_meta()}
					count={groups.data.rowCount}
					linkProps={{
						to: "/app/groups",
					}}
					linked={hasCapability(capabilities, "manage_groups")}
				/>
				{hasCapability(capabilities, "invite_members") ? (
					<InvitationsRow
						linked={hasCapability(capabilities, "manage_members")}
					/>
				) : null}
			</PanelRows>
		</Panel>
	);
};

export { ManagePeoplePanel };
