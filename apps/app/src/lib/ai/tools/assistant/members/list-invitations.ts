import * as Effect from "effect/Effect";
import { effectTool } from "@/lib/ai/tools/tool-builders";
import { listPage, listPaging, PAGING_NOTE } from "../list-input";
import { type AssistantToolDeps, callProcedure } from "../procedure-tool";
import { listInvitationsInputSchema } from "./list-invitations.declaration";

export const listInvitationsTool = (deps: AssistantToolDeps) =>
	effectTool({
		description: `List the invitations of the active organisation with one status, pending unless you pass another, newest first. A pending invitation past its expiry can no longer be accepted. ${PAGING_NOTE}`,
		inputSchema: listInvitationsInputSchema,
		run: ({ status, page }) =>
			callProcedure(deps, (procedures, options) =>
				procedures.organizationInvitation.list(
					{
						...listPage(page),
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
							id: invitation.id,
							email: invitation.email,
							role: invitation.role,
							status: invitation.status,
							expiresAt: invitation.expiresAt.toISOString(),
							expired: invitation.expiresAt.getTime() < now,
						})),
						...listPaging(page, rowCount),
					};
				}),
			),
	});
