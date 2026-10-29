import {
	ANIMATED_GIF,
	centrePixel,
	PNG,
	saveImageThroughDialog,
} from "../../fixtures/account/images";
import {
	accountCard,
	openAccountPage,
	userMenu,
} from "../../fixtures/account/navigation";
import { createAccountUser } from "../../fixtures/account/users";
import { pageForSession } from "../../fixtures/auth/users";
import { EMAIL_DOMAIN, USER_PASSWORD } from "../../fixtures/constants";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { runId } from "../../fixtures/organisation";

test("account: a user crops a picture, sees it in the menu and removes it", async ({
	api,
	appBaseURL,
	browser,
}) => {
	const user = await createAccountUser({
		baseURL: appBaseURL,
		label: "picture",
		admin: api.as("admin"),
	});
	const { context, page } = await pageForSession(browser, user.session);

	try {
		await openAccountPage(page);
		const card = accountCard(page, message("account_profile_card_title"));
		await saveImageThroughDialog(
			page,
			card.getByRole("button", {
				name: message("images_picture_change_button"),
			}),
			PNG,
		);

		// The menu reads the router context, which the save reloads.
		const picture = userMenu(page, user.name).getByRole("img", {
			name: user.name,
		});
		await expect(picture).toHaveAttribute(
			"src",
			/^\/api\/images\/users\/[0-9a-f-]+\/[0-9a-f-]+\.webp$/,
		);
		const src = (await picture.getAttribute("src")) ?? "";
		expect((await user.api.user.me({})).data.image).toBe(src);

		const response = await page.request.get(src);
		expect(response.status()).toBe(200);
		expect(response.headers()["content-type"]).toBe("image/webp");
		expect(response.headers()["cache-control"]).toBe("private, no-cache");
		expect(response.headers()["x-content-type-options"]).toBe("nosniff");
		const etag = response.headers().etag ?? "";
		expect(etag).not.toBe("");
		const revalidated = await page.request.get(src, {
			headers: {
				"If-None-Match": etag,
			},
		});
		expect(revalidated.status()).toBe(304);

		expect(await centrePixel(page, src)).toMatchObject({
			width: 256,
			height: 256,
		});

		// Without a session the route refuses before it looks at the path.
		expect((await fetch(`${appBaseURL}${src}`)).status).toBe(401);

		await card
			.getByRole("button", {
				name: message("images_picture_remove_button"),
			})
			.click();
		await expect(picture).toHaveCount(0);
		await expect(userMenu(page, user.name).getByText("EP")).toBeVisible();
		expect((await user.api.user.me({})).data.image).toBeNull();
		expect((await page.request.get(src)).status()).toBe(404);
	} finally {
		await context.close();
	}
});

test("account: an animated GIF keeps its first frame", async ({
	api,
	appBaseURL,
	browser,
}) => {
	const user = await createAccountUser({
		baseURL: appBaseURL,
		label: "gif",
		admin: api.as("admin"),
	});
	const { context, page } = await pageForSession(browser, user.session);

	try {
		await openAccountPage(page);
		await saveImageThroughDialog(
			page,
			accountCard(page, message("account_profile_card_title")).getByRole(
				"button",
				{
					name: message("images_picture_change_button"),
				},
			),
			ANIMATED_GIF,
		);

		const image = (await user.api.user.me({})).data.image ?? "";
		const pixel = await centrePixel(page, image);
		expect(pixel.red).toBeGreaterThan(200);
		expect(pixel.blue).toBeLessThan(60);
	} finally {
		await context.close();
	}
});

test("account: Better Auth takes no picture URL", async ({
	api,
	appBaseURL,
}) => {
	const user = await createAccountUser({
		baseURL: appBaseURL,
		label: "picture-url",
		admin: api.as("admin"),
	});
	const forged = `/api/images/users/${crypto.randomUUID()}/${crypto.randomUUID()}.webp`;

	for (const image of [
		"https://example.org/tracker.png",
		forged,
	]) {
		const updated = await fetch(`${appBaseURL}/api/auth/update-user`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				cookie: user.session.cookieHeader,
				origin: appBaseURL,
			},
			body: JSON.stringify({
				image,
			}),
		});
		expect(updated.status).toBe(400);
		expect(await updated.json()).toMatchObject({
			code: "PROFILE_IMAGE_UPLOAD_REQUIRED",
		});

		const email = `account-signup-image-${runId()}-${crypto.randomUUID().slice(0, 6)}@${EMAIL_DOMAIN}`;
		const {
			data: [invitation],
		} = await api.as("admin").organizationInvitation.create({
			role: "member",
			expiresAt: new Date(Date.now() + 86_400_000),
			items: [
				{
					email,
				},
			],
		});
		const signedUp = await fetch(`${appBaseURL}/api/auth/sign-up/email`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				origin: appBaseURL,
			},
			body: JSON.stringify({
				invitationId: invitation?.id,
				name: "E2E Picture URL",
				email,
				password: USER_PASSWORD,
				image,
			}),
		});
		expect(signedUp.ok).toBe(false);
		expect(await signedUp.json()).toMatchObject({
			code: "PROFILE_IMAGE_UPLOAD_REQUIRED",
		});
	}

	expect((await user.api.user.me({})).data.image).toBeNull();
});

test("account: the crop dialog keeps Save on a phone screen", async ({
	api,
	appBaseURL,
	browser,
}) => {
	const user = await createAccountUser({
		baseURL: appBaseURL,
		label: "picture-phone",
		admin: api.as("admin"),
	});
	const { context, page } = await pageForSession(browser, user.session);

	try {
		for (const viewport of [
			{
				width: 390,
				height: 640,
			},
			{
				width: 844,
				height: 390,
			},
		]) {
			await page.setViewportSize(viewport);
			await openAccountPage(page);
			await page
				.getByRole("button", {
					name: message("images_picture_change_button"),
				})
				.click();
			const dialog = page.getByRole("dialog");
			await dialog.locator('input[type="file"]').setInputFiles(PNG);
			await expect(
				dialog.getByRole("button", {
					name: message("common_save_button"),
				}),
			).toBeInViewport({
				ratio: 1,
			});
			await page.keyboard.press("Escape");
			await expect(dialog).toBeHidden();
		}
	} finally {
		await context.close();
	}
});
