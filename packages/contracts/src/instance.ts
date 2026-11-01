import {
	addInstanceOrganizationMemberInputSchema,
	findInstanceOrganizationInputSchema,
	findInstanceOrganizationReadinessInputSchema,
	findInstanceOrganizationResponseSchema,
	findInstanceUserInputSchema,
	findInstanceUserResponseSchema,
	findOrganizationReadinessResponseSchema,
	handOverActionResponseSchema,
	instanceMembershipActionResponseSchema,
	inviteInstanceOrganizationMemberInputSchema,
	listContentReceiversResponseSchema,
	listInstanceContentReceiversInputSchema,
	listInstanceOrganizationMembersInputSchema,
	listInstanceOrganizationMembersResponseSchema,
	listInstanceOwnedContentInputSchema,
	listInstanceUserMembershipsInputSchema,
	listInstanceUserMembershipsResponseSchema,
	listOwnedContentResponseSchema,
	removeInstanceImageResponseSchema,
	removeInstanceOrganizationLogoInputSchema,
	removeInstanceOrganizationMemberInputSchema,
	removeInstanceUserImageInputSchema,
	updateInstanceOrganizationMemberInputSchema,
} from "@orcai/schema";
import { openapi } from "@orpc/openapi";
import { base } from "./base";

const tags = [
	"Instance",
];

export const instanceContracts = {
	user: base
		.meta(
			openapi({
				method: "GET",
				path: "/instance/users/{id}",
				summary: "Find any account of the instance",
				tags,
			}),
		)
		.input(findInstanceUserInputSchema)
		.output(findInstanceUserResponseSchema),
	userMemberships: base
		.meta(
			openapi({
				method: "GET",
				path: "/instance/users/{userId}/memberships",
				summary: "List the organisations an account belongs to",
				tags,
			}),
		)
		.input(listInstanceUserMembershipsInputSchema)
		.output(listInstanceUserMembershipsResponseSchema),
	organization: base
		.meta(
			openapi({
				method: "GET",
				path: "/instance/organizations/{id}",
				summary: "Find any organisation of the instance",
				tags,
			}),
		)
		.input(findInstanceOrganizationInputSchema)
		.output(findInstanceOrganizationResponseSchema),
	organizationMembers: base
		.meta(
			openapi({
				method: "GET",
				path: "/instance/organizations/{organizationId}/members",
				summary: "List an organisation's members",
				tags,
			}),
		)
		.input(listInstanceOrganizationMembersInputSchema)
		.output(listInstanceOrganizationMembersResponseSchema),
	organizationReadiness: base
		.meta(
			openapi({
				method: "GET",
				path: "/instance/organizations/{organizationId}/readiness",
				summary: "What an organisation still needs before its members can chat",
				tags,
			}),
		)
		.input(findInstanceOrganizationReadinessInputSchema)
		.output(findOrganizationReadinessResponseSchema),
	addMember: base
		.meta(
			openapi({
				method: "POST",
				path: "/instance/organizations/{organizationId}/members",
				summary: "Add an existing account to an organisation",
				tags,
			}),
		)
		.input(addInstanceOrganizationMemberInputSchema)
		.output(instanceMembershipActionResponseSchema),
	changeMemberRole: base
		.meta(
			openapi({
				method: "PATCH",
				path: "/instance/organizations/{organizationId}/members/{userId}",
				summary: "Change a member's role in an organisation",
				tags,
				description: "The organisation keeps at least one admin.",
			}),
		)
		.input(updateInstanceOrganizationMemberInputSchema)
		.output(handOverActionResponseSchema),
	removeMember: base
		.meta(
			openapi({
				method: "DELETE",
				path: "/instance/organizations/{organizationId}/members/{userId}",
				summary: "Remove a member from an organisation",
				tags,
				description: "The organisation keeps at least one admin.",
			}),
		)
		.input(removeInstanceOrganizationMemberInputSchema)
		.output(handOverActionResponseSchema),
	ownedContent: base
		.meta(
			openapi({
				method: "GET",
				path: "/instance/owned-content",
				summary: "List what accounts own, per organisation",
				tags,
				description:
					"Bots, blocks and Library assets, with the receiver a handover defaults to.",
			}),
		)
		.input(listInstanceOwnedContentInputSchema)
		.output(listOwnedContentResponseSchema),
	receivers: base
		.meta(
			openapi({
				method: "GET",
				path: "/instance/organizations/{organizationId}/receivers",
				summary: "List the members who may receive content in an organisation",
				tags,
			}),
		)
		.input(listInstanceContentReceiversInputSchema)
		.output(listContentReceiversResponseSchema),
	inviteMember: base
		.meta(
			openapi({
				method: "POST",
				path: "/instance/organizations/{organizationId}/invitations",
				summary: "Invite someone to an organisation by email",
				tags,
				description: "Refused for an address that already belongs to a member.",
			}),
		)
		.input(inviteInstanceOrganizationMemberInputSchema)
		.output(instanceMembershipActionResponseSchema),
	removeUserImage: base
		.meta(
			openapi({
				method: "DELETE",
				path: "/instance/users/{id}/image",
				summary: "Remove any account's profile picture",
				tags,
			}),
		)
		.input(removeInstanceUserImageInputSchema)
		.output(removeInstanceImageResponseSchema),
	removeOrganizationLogo: base
		.meta(
			openapi({
				method: "DELETE",
				path: "/instance/organizations/{id}/logo",
				summary: "Remove any organisation's logo",
				tags,
			}),
		)
		.input(removeInstanceOrganizationLogoInputSchema)
		.output(removeInstanceImageResponseSchema),
};
