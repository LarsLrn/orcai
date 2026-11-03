import {
	banUserInputSchema,
	banUserResponseSchema,
	deleteUsersInputSchema,
	deleteUsersResponseSchema,
	listAllUsersInputSchema,
	listAllUsersResponseSchema,
	meInputSchema,
	meResponseSchema,
	removeUserImageInputSchema,
	removeUserImageResponseSchema,
	resetTwoFactorInputSchema,
	resetTwoFactorResponseSchema,
	setActiveOrganizationInputSchema,
	setActiveOrganizationResponseSchema,
	setInstanceRoleInputSchema,
	setInstanceRoleResponseSchema,
	setTourStateInputSchema,
	setTourStateResponseSchema,
	setUserImageInputSchema,
	setUserImageResponseSchema,
	unbanUserInputSchema,
	unbanUserResponseSchema,
	updatePasswordInputSchema,
	updatePasswordResponseSchema,
} from "@orcai/schema";
import { openapi } from "@orpc/openapi";
import { base } from "./base";

const tagged = base.meta(
	openapi({
		tags: [
			"Users",
		],
	}),
);

export const userContracts = {
	listAll: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/instance/users",
				summary: "List every user of the instance",
			}),
		)
		.input(listAllUsersInputSchema)
		.output(listAllUsersResponseSchema),
	delete: tagged
		.meta(
			openapi({
				method: "DELETE",
				path: "/users",
				summary: "Delete users",
			}),
		)
		.input(deleteUsersInputSchema)
		.output(deleteUsersResponseSchema),
	ban: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/users/actions/ban",
				summary: "Ban an account",
			}),
		)
		.input(banUserInputSchema)
		.output(banUserResponseSchema),
	unban: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/users/actions/unban",
				summary: "Lift the ban on an account",
			}),
		)
		.input(unbanUserInputSchema)
		.output(unbanUserResponseSchema),
	resetTwoFactor: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/users/actions/reset-two-factor",
				summary: "Reset an account's two-factor authentication",
				description:
					"Removes the account's second factor and trusted devices and ends its sessions.",
			}),
		)
		.input(resetTwoFactorInputSchema)
		.output(resetTwoFactorResponseSchema),
	setInstanceRole: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/users/actions/set-instance-role",
				summary:
					"Make an account an instance admin, or a regular account again",
				description:
					"Nobody changes their own instance role, so an instance admin always remains.",
			}),
		)
		.input(setInstanceRoleInputSchema)
		.output(setInstanceRoleResponseSchema),
	me: tagged
		.meta(
			openapi({
				method: "GET",
				path: "/users/me",
				summary: "Get current user",
				description: "Get the current user's data.",
			}),
		)
		.input(meInputSchema)
		.output(meResponseSchema),
	updatePassword: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/users/actions/password",
				summary: "Update user password",
				description: "Update the password for a user.",
			}),
		)
		.input(updatePasswordInputSchema)
		.output(updatePasswordResponseSchema),
	setImage: tagged
		.meta(
			openapi({
				method: "PUT",
				path: "/users/me/image",
				summary: "Set your profile picture",
				description:
					"Takes a square WebP of at most 256 KB uploaded through the `profileImage` route.",
			}),
		)
		.input(setUserImageInputSchema)
		.output(setUserImageResponseSchema),
	removeImage: tagged
		.meta(
			openapi({
				method: "DELETE",
				path: "/users/me/image",
				summary: "Remove your profile picture",
			}),
		)
		.input(removeUserImageInputSchema)
		.output(removeUserImageResponseSchema),
	setActiveOrganization: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/users/actions/set-active-organization",
				summary: "Set active organisation",
				description: "Set the active organisation for a user.",
			}),
		)
		.input(setActiveOrganizationInputSchema)
		.output(setActiveOrganizationResponseSchema),
	setTourState: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/users/actions/set-tour-state",
				summary: "Set tour state",
				description: "Set the tour state for a user.",
			}),
		)
		.input(setTourStateInputSchema)
		.output(setTourStateResponseSchema),
};
