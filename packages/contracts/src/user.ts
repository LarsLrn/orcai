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

export const userContracts = {
	listAll: base
		.meta(
			openapi({
				method: "GET",
				path: "/instance/users",
				summary: "List every user of the instance",
				tags: [
					"Users",
				],
			}),
		)
		.input(listAllUsersInputSchema)
		.output(listAllUsersResponseSchema),
	delete: base
		.meta(
			openapi({
				method: "DELETE",
				path: "/users",
				summary: "Delete users",
				tags: [
					"Users",
				],
			}),
		)
		.input(deleteUsersInputSchema)
		.output(deleteUsersResponseSchema),
	ban: base
		.meta(
			openapi({
				method: "POST",
				path: "/users/actions/ban",
				summary: "Ban an account",
				tags: [
					"Users",
				],
			}),
		)
		.input(banUserInputSchema)
		.output(banUserResponseSchema),
	unban: base
		.meta(
			openapi({
				method: "POST",
				path: "/users/actions/unban",
				summary: "Lift the ban on an account",
				tags: [
					"Users",
				],
			}),
		)
		.input(unbanUserInputSchema)
		.output(unbanUserResponseSchema),
	resetTwoFactor: base
		.meta(
			openapi({
				method: "POST",
				path: "/users/actions/reset-two-factor",
				summary: "Reset an account's two-factor authentication",
				description:
					"Removes the account's second factor and trusted devices and ends its sessions.",
				tags: [
					"Users",
				],
			}),
		)
		.input(resetTwoFactorInputSchema)
		.output(resetTwoFactorResponseSchema),
	setInstanceRole: base
		.meta(
			openapi({
				method: "POST",
				path: "/users/actions/set-instance-role",
				summary: "Make an account an instance administrator, or a user again",
				description:
					"Nobody changes their own instance role, so an instance administrator always remains.",
				tags: [
					"Users",
				],
			}),
		)
		.input(setInstanceRoleInputSchema)
		.output(setInstanceRoleResponseSchema),
	me: base
		.meta(
			openapi({
				method: "GET",
				path: "/users/me",
				summary: "Get current user",
				tags: [
					"Users",
				],
				description: "Get the current user's data.",
			}),
		)
		.input(meInputSchema)
		.output(meResponseSchema),
	updatePassword: base
		.meta(
			openapi({
				method: "POST",
				path: "/users/actions/password",
				summary: "Update user password",
				tags: [
					"Users",
				],
				description: "Update the password for a user.",
			}),
		)
		.input(updatePasswordInputSchema)
		.output(updatePasswordResponseSchema),
	setImage: base
		.meta(
			openapi({
				method: "PUT",
				path: "/users/me/image",
				summary: "Set your profile picture",
				description:
					"Takes a square WebP of at most 256 KB uploaded through the `profileImage` route.",
				tags: [
					"Users",
				],
			}),
		)
		.input(setUserImageInputSchema)
		.output(setUserImageResponseSchema),
	removeImage: base
		.meta(
			openapi({
				method: "DELETE",
				path: "/users/me/image",
				summary: "Remove your profile picture",
				tags: [
					"Users",
				],
			}),
		)
		.input(removeUserImageInputSchema)
		.output(removeUserImageResponseSchema),
	setActiveOrganization: base
		.meta(
			openapi({
				method: "POST",
				path: "/users/actions/set-active-organization",
				summary: "Set active organization",
				tags: [
					"Users",
				],
				description: "Set the active organization for a user.",
			}),
		)
		.input(setActiveOrganizationInputSchema)
		.output(setActiveOrganizationResponseSchema),
	setTourState: base
		.meta(
			openapi({
				method: "POST",
				path: "/users/actions/set-tour-state",
				summary: "Set tour state",
				tags: [
					"Users",
				],
				description: "Set the tour state for a user.",
			}),
		)
		.input(setTourStateInputSchema)
		.output(setTourStateResponseSchema),
};
