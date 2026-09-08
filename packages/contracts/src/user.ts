import {
	banUserInputSchema,
	banUserResponseSchema,
	deleteUsersInputSchema,
	deleteUsersResponseSchema,
	findUserInputSchema,
	findUserResponseSchema,
	listAllUsersInputSchema,
	listAllUsersResponseSchema,
	listUserAccessInputSchema,
	listUserAccessResponseSchema,
	listUsersInputSchema,
	listUsersResponseSchema,
	meInputSchema,
	meResponseSchema,
	setActiveOrganizationInputSchema,
	setActiveOrganizationResponseSchema,
	setTourStateInputSchema,
	setTourStateResponseSchema,
	unbanUserInputSchema,
	unbanUserResponseSchema,
	updatePasswordInputSchema,
	updatePasswordResponseSchema,
} from "@orcai/schema";
import { openapi } from "@orpc/openapi";
import { base } from "./base";

export const userContracts = {
	list: base
		.meta(
			openapi({
				method: "GET",
				path: "/users",
				summary: "List all users",
				tags: [
					"Users",
				],
			}),
		)
		.input(listUsersInputSchema)
		.output(listUsersResponseSchema),
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
	find: base
		.meta(
			openapi({
				method: "GET",
				path: "/users/{id}",
				summary: "Find a user",
				tags: [
					"Users",
				],
				description: "Find a user by their ID.",
			}),
		)
		.input(findUserInputSchema)
		.output(findUserResponseSchema),
	listAccess: base
		.meta(
			openapi({
				method: "GET",
				path: "/users/{id}/access",
				summary: "List effective resource access entries for a user",
				tags: [
					"Users",
				],
			}),
		)
		.input(listUserAccessInputSchema)
		.output(listUserAccessResponseSchema),
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
