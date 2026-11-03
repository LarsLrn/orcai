import { organizationInvitationStatusSchema } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import {
	listPage,
	listPageSchema,
	listPaging,
	PAGING_NOTE,
} from "../core/list-input";
import {
	type AssistantToolDeps,
	callProcedure,
	effectTool,
} from "../procedure-tool";

const listInvitationsInputSchema = z.strictObject({
	status: organizationInvitationStatusSchema.default("pending"),
	page: listPageSchema,
});

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
