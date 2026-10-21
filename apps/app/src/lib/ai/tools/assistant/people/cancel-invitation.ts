import type { OrganizationInvitationId } from "@orcai/core";
import { organizationInvitationIdSchema } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import {
	type AssistantToolDeps,
	callProcedure,
	effectTool,
	expectType,
	mutation,
} from "../procedure-tool";

const cancelInvitationInputSchema = z.object({
	ids: z
		.array(organizationInvitationIdSchema)
		.min(1)
		.max(20)
		.describe("Ids of the invitations to withdraw, from listInvitations."),
});

/** The organisation's newest invitations; withdrawing an older one leaves its email unnamed. */
const INVITATION_LOOKUP_LIMIT = 1000;

/** Emails are read before the invitations are gone, so the summary can still show them. */
export const cancelInvitations = (
	deps: AssistantToolDeps,
	ids: OrganizationInvitationId[],
) =>
	Effect.gen(function* () {
		const unique = [
			...new Set(ids),
		];
		const emails = yield* callProcedure(deps, (procedures, options) =>
			procedures.organizationInvitation.list(
				{
					pageSize: INVITATION_LOOKUP_LIMIT,
				},
				options,
			),
		).pipe(
			Effect.map(
				({ data }) =>
					new Map(
						data.map((invitation) => [
							invitation.id,
							invitation.email,
						]),
					),
			),
			Effect.orElseSucceed(() => new Map<string, string>()),
		);

		yield* callProcedure(deps, (procedures, options) =>
			procedures.organizationInvitation.delete(
				{
					refs: unique.map((id) => ({
						id,
					})),
				},
				options,
			),
		).pipe(
			mutation("listInvitations"),
			expectType(
				"invitation",
				unique.some((id) => !emails.has(id))
					? unique.filter((id) => !emails.has(id))
					: unique,
			),
		);

		return {
			withdrawn: unique.map((id) => ({
				type: "invitation" as const,
				id,
				email: emails.get(id),
			})),
		};
	});

export const cancelInvitationTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Withdraw invitations to the active organisation, so their links stop working.",
		inputSchema: cancelInvitationInputSchema,
		run: ({ ids }) => cancelInvitations(deps, ids),
	});
