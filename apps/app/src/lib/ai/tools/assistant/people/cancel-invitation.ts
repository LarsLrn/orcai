import type { OrganizationInvitationId } from "@orcai/core";
import { organizationInvitationIdSchema } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import { effectTool } from "@/lib/ai/tools/tool-builders";
import { deleteNamed } from "../named-delete";
import type { AssistantToolDeps } from "../procedure-tool";

const cancelInvitationInputSchema = z.strictObject({
	ids: z
		.array(organizationInvitationIdSchema)
		.min(1)
		.max(20)
		.describe("Ids of the invitations to withdraw, from listInvitations."),
});

export const cancelInvitations = (
	deps: AssistantToolDeps,
	ids: OrganizationInvitationId[],
) =>
	deleteNamed(deps, ids, {
		type: "invitation",
		find: (id, procedures, options) =>
			procedures.organizationInvitation.find(
				{
					id,
				},
				options,
			),
		name: ({ data }) => data.email,
		verify: "listInvitations",
		remove: (ids, procedures, options) =>
			procedures.organizationInvitation.delete(
				{
					refs: ids.map((id) => ({
						id,
					})),
				},
				options,
			),
	}).pipe(
		Effect.map(({ deleted }) => ({
			withdrawn: deleted.map(({ type, id, name }) => ({
				type,
				id,
				email: name,
			})),
		})),
	);

export const cancelInvitationTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Withdraw invitations to the active organisation, so they can no longer be accepted.",
		inputSchema: cancelInvitationInputSchema,
		run: ({ ids }) => cancelInvitations(deps, ids),
	});
