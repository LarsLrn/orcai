import type { OrganizationId, UserId } from "@orcai/core";
import type { ReceiverSource } from "@/components/ownership/receiver-picker";
import { orpc } from "@/lib/orpc/orpc";

/**
 * Who changes memberships: a manager of the active organisation, or an
 * instance admin in one organisation or, deleting accounts, in all of them.
 */
export type MembershipScope =
	| {
			kind: "active-organization";
	  }
	| {
			kind: "instance";
			organizationId?: OrganizationId;
	  };

/**
 * What the users own where the scope reaches, with the default receivers.
 * Always read afresh, since a confirmation acts on it.
 */
export const ownedContentQuery = (scope: MembershipScope, userIds: UserId[]) =>
	scope.kind === "active-organization"
		? orpc.organizationMember.ownedContent.queryOptions({
				input: {
					userIds,
				},
				staleTime: 0,
			})
		: orpc.instance.ownedContent.queryOptions({
				input: {
					userIds,
					organizationId: scope.organizationId,
				},
				staleTime: 0,
			});

/** Where an organisation's receivers come from within the scope. */
export const receiverSourceOf = (
	scope: MembershipScope,
	organizationId: OrganizationId,
): ReceiverSource =>
	scope.kind === "active-organization"
		? scope
		: {
				kind: "instance",
				organizationId,
			};
