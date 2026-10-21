import { organizationInvitationStatusSchema } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import { runAssistantTool } from "@/lib/ai/tools/tool-error";
import { organizationInvitationProcedures } from "@/lib/orpc/router/organization-invitation";
import { listLimitSchema } from "../core/list-input";
import {
	type AssistantToolDeps,
	assistantTool,
	callProcedure,
} from "../procedure-tool";

export const listInvitationsInputSchema = z.object({
	status: organizationInvitationStatusSchema.default("pending"),
	limit: listLimitSchema,
});

export const listInvitationsTool = (deps: AssistantToolDeps) =>
	assistantTool({
		description:
			"List the invitations of the active organisation, newest first. A pending invitation past its expiry can no longer be accepted.",
		inputSchema: listInvitationsInputSchema,
		execute: ({ status, limit }, { abortSignal }) =>
			runAssistantTool(
				callProcedure(deps, (options) =>
					organizationInvitationProcedures.list(
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
				abortSignal,
			),
		toModelOutput: ({ output }) => ({
			type: "json",
			value: output,
		}),
	});
