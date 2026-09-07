import { randomBytes } from "node:crypto";
import { ORPCError } from "@orpc/client";
import {
	activeOrganizationOf,
	attemptSignUp,
	signUpInvited,
} from "../../fixtures/auth";
import { EMAIL_DOMAIN, USER_PASSWORD } from "../../fixtures/constants";
import { expect, test } from "../../fixtures/index";
import { open } from "../../fixtures/navigation";

const freshEmail = (label: string) =>
	`auth-${label}-${randomBytes(3).toString("hex")}@${EMAIL_DOMAIN}`;

test("the register page turns away a visitor without an invitation", async ({
	page,
}) => {
	await open(page, "/en/register");

	// Registration is by invitation, so the bare page says so and points at
	// sign-in instead of offering a form.
	await expect(page.getByText("Registration is by invitation")).toBeVisible();
	await expect(
		page.getByRole("button", {
			name: "Register",
		}),
	).toHaveCount(0);
	await expect(
		page.getByRole("link", {
			name: "Go to sign in",
		}),
	).toBeVisible();
});

test("sign-up without an invitation is refused", async ({
	api,
	appBaseURL,
}) => {
	const email = freshEmail("uninvited");

	const response = await attemptSignUp(appBaseURL, {
		name: "E2E Uninvited",
		email,
		password: USER_PASSWORD,
	});

	expect(response.ok).toBe(false);
	expect(await response.text()).toContain("invitation");

	// The hook refuses before the row is written, so the address stays unknown
	// to the instance.
	const users = await api.asWellKnownAdmin().user.listAll({
		pageIndex: 0,
		pageSize: 20,
		filters: {
			search: email,
		},
	});
	expect(users.data.map((user) => user.email)).not.toContain(email);
});

test("sign-up consumes the invitation and enters the organisation", async ({
	api,
	appBaseURL,
	org,
}) => {
	const email = freshEmail("invited");
	const session = await signUpInvited({
		baseURL: appBaseURL,
		admin: api.asWellKnownAdmin(),
		organisation: org,
		role: "viewer",
		name: "E2E Invited",
		email,
	});

	// The invitation is spent by the sign-up itself; nothing is left to accept.
	const validated = await api.as("admin").organizationInvitation.validate({
		id: session.invitationId,
	});
	expect(validated.data.isValid).toBe(false);
	expect(validated.data.reason).toBe("consumed");

	// Sign-up wrote the membership with the invited role, and with one
	// organisation the new session already sits inside it.
	await expect
		.poll(
			async () => {
				try {
					const users = await api.as("admin").user.list({
						pageIndex: 0,
						pageSize: 100,
					});

					return users.data.find((user) => user.email === email)
						?.organizationRole;
				} catch (error) {
					// Snapshot lag: a stale FORBIDDEN is polled away like the fixtures do.
					if (error instanceof ORPCError && error.code === "FORBIDDEN") {
						return undefined;
					}

					throw error;
				}
			},
			{
				timeout: 15_000,
			},
		)
		.toBe("viewer");

	expect(await activeOrganizationOf(appBaseURL, session)).toBe(org.id);
});
