import type { ResourceGrant, ResourceGrantRole } from "@orcai/schema";
import {
	ALL_MEMBERS_GROUP_SYSTEM_KEY,
	RESOURCE_GRANT_SOURCE,
} from "@orcai/schema";
import { Badge } from "@/components/ui/badge";
import { ROLES } from "@/settings/display-config";

const roleLabel = (role: ResourceGrantRole) =>
	ROLES.find((entry) => entry.value === role)?.label ?? role;

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
		? `All Members receives ${roleLabel(
				allMembersGrant.role,
			).toLowerCase()} access, so every member of the organisation can use this bot once it is published.`
		: "All Members has no grant, so only the groups and people listed below can use this bot once it is published.";
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
			<Badge variant="secondary">Every member of the organisation</Badge>
		) : null}
	</div>
);

/** Governance facts a publisher confirms before a bot becomes usable by others. */
const PublishSummary = ({
	visibility,
	grants,
	grantsAvailable,
}: {
	visibility?: "private" | "public";
	grants: ResourceGrant[];
	grantsAvailable: boolean;
}) => {
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
			<Fact label="Who gains access">
				{visibility === "public" ? (
					<p>
						Public. Everyone signed in to this instance can find and use this
						bot, on their own organisation's providers, models and quotas.
					</p>
				) : (
					<p>
						Private. Only the groups and people listed here can use this bot.
					</p>
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
							<p>No group has been granted access.</p>
						)}

						<p>
							{allMembersGrant
								? `All Members receives ${roleLabel(
										allMembersGrant.role,
									).toLowerCase()} access, so every member of the organisation can use this bot.`
								: "All Members has no grant, so organisation members do not gain access automatically."}
						</p>

						{userGrants.length > 0 ? (
							<div className="space-y-1">
								<p>Direct grants:</p>
								{userGrants.map((grant) => (
									<PrincipalLine key={grant.id} grant={grant} />
								))}
							</div>
						) : (
							<p>No person holds a direct grant.</p>
						)}
					</>
				) : (
					<p>
						The groups and direct grants could not be loaded, so they are not
						shown here. Open the sharing and access step to check them.
					</p>
				)}
			</Fact>

			<Fact label="Provider and model">
				<p>
					A bot does not fix a provider or a model. Each chat runs on the
					provider and model chosen in that chat, so neither can be shown here.
				</p>
			</Fact>

			<Fact label="Quota pool">
				<p>
					A bot does not fix a quota pool either. Usage is metered against the
					pool that covers the chatting person's organisation and the provider
					their chat uses.
				</p>
			</Fact>
		</div>
	);
};

export { describeAllMembersAccess, PublishSummary };
