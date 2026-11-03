import { createOrganizationInvitationsInputSchema } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import {
	type AssistantToolDeps,
	callProcedure,
	effectTool,
	mutation,
} from "../procedure-tool";
import { invitationInput, requestLocale } from "./invitation-input";

export const inviteMembersInputSchema = z.strictObject({
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
		const { data, skipped } = yield* callProcedure(
			deps,
			(procedures, options) =>
				procedures.organizationInvitation.create(request, options),
		).pipe(mutation("listInvitations"));

		return {
			invited: data.map((invitation) => ({
				type: "invitation" as const,
				id: invitation.id,
				email: invitation.email,
			})),
			skipped,
			role: input.role,
			expiresAt: request.expiresAt.toISOString(),
		};
	});

export const inviteMembersTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Invite people by email to join the active organisation with a role. Each gets an email with a link to join that is valid for 7 days. An address that already belongs to a member, or already has an invitation that has not expired, gets no new email and comes back in skipped with the reason. An expired invitation is replaced by a new one.",
		inputSchema: inviteMembersInputSchema,
		run: (input) => inviteMembers(deps, input, new Date()),
	});
