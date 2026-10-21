import type { OrganizationInvitationId } from "@orcai/core";
import { createOrganizationInvitationsInputSchema } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import { organizationInvitationProcedures } from "@/lib/orpc/router/organization-invitation";
import {
	type AssistantToolDeps,
	callProcedure,
	createOnce,
	effectTool,
	mutation,
} from "../procedure-tool";
import { invitationInput, requestLocale } from "./invitation-input";

export const inviteMembersInputSchema = z.object({
	emails: z
		.array(z.email())
		.min(1)
		.max(200)
		.describe("Email addresses to invite."),
	role: createOrganizationInvitationsInputSchema.shape.role.describe(
		"The organisation role they get on accepting. Only admins can invite admins.",
	),
});

export const inviteMembers = (
	deps: AssistantToolDeps,
	input: z.infer<typeof inviteMembersInputSchema>,
	now: Date,
) =>
	Effect.gen(function* () {
		const request = invitationInput(input, {
			now,
			locale: requestLocale(deps.context.reqHeaders),
		});
		const { data } = yield* callProcedure(deps, (options) =>
			organizationInvitationProcedures.create(request, options),
		).pipe(mutation("listInvitations"));

		return {
			invited: data.map((invitation) => ({
				type: "invitation" as const,
				id: invitation.id,
				email: invitation.email,
			})),
			role: input.role,
			expiresAt: request.expiresAt.toISOString(),
		};
	});

export const inviteMembersTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Invite people by email to join the active organisation with a role. Each gets an email with a registration link that is valid for 7 days.",
		inputSchema: inviteMembersInputSchema,
		run: (input, { toolCallId }) =>
			createOnce(
				{
					scope: deps.turn.scope,
					toolCallId,
					input,
				},
				{
					create: inviteMembers(deps, input, new Date()),
					ids: ({ invited }) => invited.map((invitation) => invitation.id),
					replay: (ids) =>
						Effect.forEach(ids, (id) =>
							callProcedure(deps, (options) =>
								organizationInvitationProcedures.find(
									{
										id: id as OrganizationInvitationId,
									},
									options,
								),
							),
						).pipe(
							Effect.map((found) => ({
								invited: found.map(({ data }) => ({
									type: "invitation" as const,
									id: data.id,
									email: data.email,
								})),
								role: input.role,
								expiresAt: found[0].data.expiresAt.toISOString(),
							})),
						),
				},
			),
	});
