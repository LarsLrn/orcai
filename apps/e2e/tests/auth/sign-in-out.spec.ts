import { randomBytes } from "node:crypto";
import { signUpInvited } from "../../fixtures/auth";
import { EMAIL_DOMAIN, USER_PASSWORD } from "../../fixtures/constants";
import { submitForm } from "../../fixtures/forms";
import { expect, test } from "../../fixtures/index";
import { enterApp, open } from "../../fixtures/navigation";

test("a member signs in through the login form, then signs out and loses access", async ({
	org,
	page,
}) => {
	const member = org.users.member;

	await open(page, "/en/login");

	await submitForm(page, {
		fill: async () => {
			await page.getByLabel("Email").fill(member.email);
			await page
				.getByLabel("Password", {
					exact: true,
				})
				.fill(member.password);
		},
		submit: "Login",
		// Sign-in leaves the login page before the app knows which
		// organisation is active, so any other URL counts.
		until: /^(?!.*\/en\/login).*$/,
	});

	await enterApp(page, org.slug);

	// The sidebar user menu is the only place that names the signed-in user.
	// Its accessible name also carries the avatar initial and the active
	// organisation, so match on the fixture user's name alone.
	const userMenu = page.getByRole("button", {
		name: /E2E member/,
	});

	await expect(userMenu).toBeVisible();
	await userMenu.click();

	await page
		.getByRole("menuitem", {
			name: "Sign Out",
		})
		.click();

	// Signing out sends the browser to the root, which redirects a visitor
	// without a session to the login page.
	await expect(page).toHaveURL(/\/en\/login/);

	await open(page, "/en/app");
	await expect(page).toHaveURL(/\/en\/login/);
	await expect(
		page.getByRole("button", {
			name: "Login",
		}),
	).toBeVisible();
});

test("a user with one organisation signs in straight into the app", async ({
	api,
	appBaseURL,
	org,
	page,
}) => {
	test.slow();

	const email = `auth-sole-org-${randomBytes(3).toString("hex")}@${EMAIL_DOMAIN}`;
	await signUpInvited({
		baseURL: appBaseURL,
		admin: api.asWellKnownAdmin(),
		organisation: org,
		role: "member",
		name: "E2E Sole Org",
		email,
	});

	// Every URL the browser reaches, so that a detour through the selection
	// page cannot pass unnoticed.
	const visited: string[] = [];
	page.on("framenavigated", (frame) => {
		if (frame === page.mainFrame()) {
			visited.push(frame.url());
		}
	});

	await open(page, "/en/login");

	// Registration is by invitation, so the login page offers no way to
	// create an account.
	await expect(
		page.getByRole("link", {
			name: /account/i,
		}),
	).toHaveCount(0);

	await submitForm(page, {
		fill: async () => {
			await page.getByLabel("Email").fill(email);
			await page
				.getByLabel("Password", {
					exact: true,
				})
				.fill(USER_PASSWORD);
		},
		submit: "Login",
		// The `session.create.before` hook makes the one organisation active
		// as the session opens, so the app route lets the user through
		// instead of sending them to the picker.
		until: /\/en\/app(\/|$)/,
	});

	expect(visited.filter((url) => url.includes("select-organization"))).toEqual(
		[],
	);
});
