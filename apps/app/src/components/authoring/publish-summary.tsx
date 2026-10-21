import type {
	RepositoryReadiness,
	ResourceGrant,
	ResourceGrantRole,
} from "@orcai/schema";
import {
	ALL_MEMBERS_GROUP_SYSTEM_KEY,
	RESOURCE_GRANT_SOURCE,
} from "@orcai/schema";
import { Badge } from "@/components/ui/badge";
import { m } from "@/paraglide/messages";
import { getResourceRoleLabel } from "@/settings/display-config";

const roleLabel = (role: ResourceGrantRole) => getResourceRoleLabel(role);

const isAllMembersGrant = (grant: ResourceGrant) =>
	grant.principal.type === "group" &&
	grant.principal.systemKey === ALL_MEMBERS_GROUP_SYSTEM_KEY;

const isDirectGrant = (grant: ResourceGrant) =>
	grant.source === RESOURCE_GRANT_SOURCE.DIRECT_USER ||
	grant.source === RESOURCE_GRANT_SOURCE.DIRECT_GROUP ||
	grant.source === RESOURCE_GRANT_SOURCE.DIRECT_GROUP_ALL_MEMBERS;

/** States the All Members consequence from the grants a bot already holds. */
const describeAllMembersAccess = (grants: ResourceGrant[]) => {
	const allMembersGrant = grants.filter(isDirectGrant).find(isAllMembersGrant);

	return allMembersGrant
		? m.authoring_publish_summary_all_members_granted_before_publish({
				role: roleLabel(allMembersGrant.role),
			})
		: m.authoring_publish_summary_all_members_ungranted_before_publish();
};

const Fact = ({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) => (
	<div className="space-y-1.5">
		<div className="font-medium text-sm">{label}</div>
		<div className="space-y-1 text-muted-foreground text-sm">{children}</div>
	</div>
);

const PrincipalLine = ({ grant }: { grant: ResourceGrant }) => (
	<div className="flex min-w-0 flex-wrap items-center gap-2">
		<span className="wrap-break-word min-w-0">{grant.principal.name}</span>
		<Badge variant="outline">{roleLabel(grant.role)}</Badge>
		{isAllMembersGrant(grant) ? (
			<Badge variant="secondary">
				{m.authoring_publish_summary_all_members_badge()}
			</Badge>
		) : null}
	</div>
);

/** Governance facts a publisher confirms before a bot becomes usable by others. */
const PublishSummary = ({
	visibility,
	grants,
	grantsAvailable,
	repositories = [],
}: {
	visibility?: "private" | "public";
	grants: ResourceGrant[];
	grantsAvailable: boolean;
	/** Readiness of the bot's repositories; one not fully ready gets a note. */
	repositories?: RepositoryReadiness[];
}) => {
	const unready = repositories.filter(
		({ totals }) => totals.ready < totals.total,
	);
	const directGrants = grants.filter(isDirectGrant);
	const groupGrants = directGrants.filter(
		(grant) => grant.principal.type === "group",
	);
	const userGrants = directGrants.filter(
		(grant) => grant.principal.type === "user",
	);
	const allMembersGrant = groupGrants.find(isAllMembersGrant);

	return (
		<div className="max-h-[50vh] w-full space-y-4 overflow-y-auto text-left">
			<Fact label={m.authoring_publish_summary_access_fact_label()}>
				{visibility === "public" ? (
					<p>{m.authoring_publish_summary_public_description()}</p>
				) : (
					<p>{m.authoring_publish_summary_private_description()}</p>
				)}

				{grantsAvailable ? (
					<>
						{groupGrants.length > 0 ? (
							<div className="space-y-1">
								{groupGrants.map((grant) => (
									<PrincipalLine key={grant.id} grant={grant} />
								))}
							</div>
						) : (
							<p>{m.authoring_publish_summary_no_group_grants()}</p>
						)}

						<p>
							{allMembersGrant
								? m.authoring_publish_summary_all_members_granted({
										role: roleLabel(allMembersGrant.role),
									})
								: m.authoring_publish_summary_all_members_ungranted()}
						</p>

						{userGrants.length > 0 ? (
							<div className="space-y-1">
								<p>{m.authoring_publish_summary_direct_grants_label()}</p>
								{userGrants.map((grant) => (
									<PrincipalLine key={grant.id} grant={grant} />
								))}
							</div>
						) : (
							<p>{m.authoring_publish_summary_no_user_grants()}</p>
						)}
					</>
				) : (
					<p>{m.authoring_publish_summary_grants_unavailable()}</p>
				)}
			</Fact>

			{unready.length > 0 ? (
				<Fact label={m.authoring_publish_summary_documents_fact_label()}>
					{unready.map(({ blockId, name, totals }) => (
						<p key={blockId}>
							{m.authoring_publish_summary_documents_ready({
								name,
								ready: totals.ready,
								total: totals.total,
							})}
							{totals.failed > 0
								? ` ${m.authoring_publish_summary_documents_failed({
										count: totals.failed,
									})}`
								: null}
						</p>
					))}
					<p>{m.authoring_publish_summary_documents_description()}</p>
				</Fact>
			) : null}

			<Fact label={m.authoring_publish_summary_provider_fact_label()}>
				<p>{m.authoring_publish_summary_provider_description()}</p>
			</Fact>

			<Fact label={m.authoring_publish_summary_quota_fact_label()}>
				<p>{m.authoring_publish_summary_quota_description()}</p>
			</Fact>
		</div>
	);
};

export { describeAllMembersAccess, PublishSummary };
