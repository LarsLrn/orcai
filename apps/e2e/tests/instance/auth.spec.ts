import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { open } from "../../fixtures/navigation";

test.describe.configure({
	mode: "serial",
});

test("the init page is gone once the instance is initialised", async ({
	page,
}) => {
	await open(page, "/init");

	// The loader reads the bootstrap status and sends a visitor away as soon
	// as an admin exists, so the first-run form can never be replayed.
	await expect(page).toHaveURL(/\/login/);
	await expect(
		page.getByRole("button", {
			name: message("auth_signin_form_submit_button"),
		}),
	).toBeVisible();
});

test("the root path sends a signed-out visitor to the login page", async ({
	page,
}) => {
	await open(page, "/");

	await expect(page).toHaveURL(/\/login/);
	await expect(
		page.getByRole("button", {
			name: message("auth_signin_form_submit_button"),
		}),
	).toBeVisible();
});

test("instance management sends a signed-out visitor to the login page", async ({
	page,
}) => {
	await open(page, "/instance/users");

	await expect(page).toHaveURL(/\/login/);
	await expect(
		page.getByRole("button", {
			name: message("auth_signin_form_submit_button"),
		}),
	).toBeVisible();
});
