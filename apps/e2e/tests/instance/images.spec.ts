import { setPictureThroughApi } from "../../fixtures/account/images";
import { createAccountUser } from "../../fixtures/account/users";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { open } from "../../fixtures/navigation";

test("instance: an instance admin removes an account's picture from its page", async ({
	api,
	appBaseURL,
	pageAsWellKnownAdmin,
}) => {
	const user = await createAccountUser({
		baseURL: appBaseURL,
		label: "moderated",
		admin: api.as("admin"),
	});
	const picture = await setPictureThroughApi(user.api);
	const {
		data: { id },
	} = await user.api.user.me({});

	const page = await pageAsWellKnownAdmin();
	await open(page, `/instance/users/${id}`);
	const shown = page.getByRole("img", {
		name: user.name,
	});
	await expect(shown).toHaveAttribute("src", picture);

	await page
		.getByRole("button", {
			name: message("common_more_actions"),
		})
		.click();
	await page
		.getByRole("menuitem", {
			name: message("images_picture_remove_button"),
		})
		.click();
	await page
		.getByRole("button", {
			name: message("common_remove_button"),
			exact: true,
		})
		.click();

	await expect(shown).toHaveCount(0);
	expect((await user.api.user.me({})).data.image).toBeNull();
	expect((await page.request.get(picture)).status()).toBe(404);
});
