import type { OrganizationInvitationId } from "@orcai/core";
import * as Effect from "effect/Effect";
import { effectTool } from "@/lib/ai/tools/tool-builders";
import { deleteNamed } from "../named-delete";
import type { AssistantToolDeps } from "../procedure-tool";
import { cancelInvitationInputSchema } from "./cancel-invitation.declaration";

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
