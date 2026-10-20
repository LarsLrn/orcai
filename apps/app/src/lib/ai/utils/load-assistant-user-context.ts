import type { OrganizationId } from "@orcai/core";
import * as Effect from "effect/Effect";
import type { AssistantUserContext } from "@/lib/ai/agents/assistant-system-prompt";
import { capabilitySets } from "@/lib/authz/capabilities";
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import { authorizationProcedures } from "@/lib/orpc/router/authorization";
import { organizationProcedures } from "@/lib/orpc/router/organization";
import { organizationMemberProcedures } from "@/lib/orpc/router/organization-member";

/** The caller, with their organisation, role and capabilities read in their own context. */
export const loadAssistantUserContext = ({
	user,
	organizationId,
	context,
}: {
	user: AssistantUserContext["user"];
	organizationId: OrganizationId;
	context: ORPCContext;
}) =>
	Effect.all(
		[
			organizationProcedures.find(
				{
					id: organizationId,
				},
				{
					context,
				},
			),
			organizationMemberProcedures.find(
				{
					userId: user.id,
				},
				{
					context,
				},
			),
			authorizationProcedures.organizationCapabilities(
				{},
				{
					context,
				},
			),
		],
		{
			concurrency: "unbounded",
		},
	).pipe(
		Effect.map(
			([organization, member, capabilities]): AssistantUserContext => ({
				user,
				organizationName: organization.data.name,
				role: member.data.role,
				capabilities: Object.fromEntries(
					capabilitySets.organization.map((permission) => [
						permission,
						capabilities.data.capabilities[permission] === true,
					]),
				) as AssistantUserContext["capabilities"],
			}),
		),
	);
