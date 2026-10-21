import { organizationInvitationStatusSchema } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import { listLimitSchema } from "../core/list-input";
import {
	type AssistantToolDeps,
	callProcedure,
	effectTool,
} from "../procedure-tool";

const listInvitationsInputSchema = z.object({
	status: organizationInvitationStatusSchema.default("pending"),
	limit: listLimitSchema,
});

export const listInvitationsTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"List the invitations of the active organisation, newest first. A pending invitation past its expiry can no longer be accepted.",
		inputSchema: listInvitationsInputSchema,
		run: ({ status, limit }) =>
			callProcedure(deps, (procedures, options) =>
				procedures.organizationInvitation.list(
					{
						pageSize: limit,
						filters: {
							status,
						},
					},
					options,
				),
			).pipe(
				Effect.map(({ data, rowCount }) => {
					const now = Date.now();

					return {
						invitations: data.map((invitation) => ({
							type: "invitation" as const,
							id: invitation.id,
							email: invitation.email,
							role: invitation.role,
							status: invitation.status,
							expiresAt: invitation.expiresAt.toISOString(),
							expired: invitation.expiresAt.getTime() < now,
						})),
						total: rowCount,
					};
				}),
			),
	});
