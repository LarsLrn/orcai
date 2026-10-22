import { randomUUID } from "node:crypto";
import { organizationIdSchema, userIdSchema } from "@orcai/schema";
import { createApiClient } from "../../fixtures/api";
import { activeOrganizationOf, signIn } from "../../fixtures/auth";
import {
	INSTANCE_ORGANISATION,
	USER_PASSWORD,
	WELL_KNOWN_ADMIN,
} from "../../fixtures/constants";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";
import { adminSession, signUpUnaffiliated } from "../../fixtures/organisation";

test("instance management has an independent route and survives the last organisation", async ({
	appBaseURL,
	browser,
	seedZedToken,
	zedTokens,
}) => {
	test.slow();
	const session = await signUpUnaffiliated({
		baseURL: appBaseURL,
		email: `instance-${randomUUID()}@e2e.orcai.test`,
		name: "Independent administrator",
	});
	const admin = await signIn(appBaseURL, WELL_KNOWN_ADMIN);
	const setRoleOverHttp = await fetch(`${appBaseURL}/api/auth/admin/set-role`, {
		method: "POST",
		headers: {
			cookie: admin.cookieHeader,
			origin: appBaseURL,
			"content-type": "application/json",
		},
		body: JSON.stringify({
			userId: session.userId,
			role: "admin",
		}),
	});
	expect(setRoleOverHttp.status).toBe(404);
	const instanceAdmin = createApiClient(appBaseURL, admin.cookieHeader);
	const setInstanceRole = (role: "admin" | "user") =>
		instanceAdmin.user.setInstanceRole({
			userId: userIdSchema.parse(session.userId),
			role,
		});
	const ordinary = await browser.newContext({
		storageState: session.storageState,
	});
	try {
		const page = await ordinary.newPage();
		await open(page, "/instance/organizations");
		await expect(page).toHaveURL(/\/select-organization/);
		await expect(
			page.getByRole("link", {
				name: message("select_organisation_page_manage_instance_link"),
			}),
		).toHaveCount(0);
	} finally {
		await ordinary.close();
	}
	await setInstanceRole("admin");
	try {
		const promoted = await signIn(appBaseURL, {
			email: session.email,
			password: USER_PASSWORD,
		});
		const client = createApiClient(
			appBaseURL,
			promoted.cookieHeader,
			zedTokens,
		);
		const context = await browser.newContext({
			storageState: promoted.storageState,
		});
		try {
			const page = await context.newPage();
			await open(page, "/select-organization");
			await expect(
				page.getByRole("link", {
					name: message("select_organisation_page_manage_instance_link"),
				}),
			).toBeVisible();

			await open(page, "/instance");
			await expect(page).toHaveURL(/\/instance\/organizations/);
			await expect(
				page.getByRole("heading", {
					name: message("instance_organizations_page_title"),
					exact: true,
				}),
			).toBeVisible();
			const created = await client.organization.create({
				name: "Only organisation",
				slug: `only-${randomUUID()}`,
			});
			const id = organizationIdSchema.parse(created.data.id);
			await client.user.setActiveOrganization({
				organizationId: id,
			});
			await seedZedToken(page);

			await open(page, "/instance/users");
			await expect(
				page.getByRole("heading", {
					name: message("instance_users_page_title"),
					exact: true,
				}),
			).toBeVisible();
			expect(await activeOrganizationOf(appBaseURL, promoted)).toBe(id);

			await page
				.getByRole("link", {
					name: message("instance_sidebar_back_to_app_action"),
				})
				.click();
			await expect(page).toHaveURL(/\/app(?:\/|$)/);
			await expect(
				page.getByRole("button", {
					name: "Only organisation",
				}),
			).toBeVisible();

			await open(page, "/app/instance/organizations");
			await expect(
				page.getByRole("heading", {
					name: message("boundaries_not_found_title"),
				}),
			).toBeVisible();

			await open(page, "/instance/organizations");
			await client.organization.delete({
				refs: [
					{
						id,
					},
				],
			});
			await seedZedToken(page);
			await open(page, "/instance/users");
			await expect(
				page.getByRole("heading", {
					name: message("instance_users_page_title"),
					exact: true,
				}),
			).toBeVisible();

			await page
				.getByRole("link", {
					name: message("instance_sidebar_back_to_app_action"),
				})
				.click();
			await expect(page).toHaveURL(/\/select-organization/);
		} finally {
			await context.close();
		}
	} finally {
		await setInstanceRole("user");
	}
});

test("the app user menu offers instance management only to instance admins", async ({
	org,
	pageAs,
	pageAsWellKnownAdmin,
}) => {
	const adminPage = await pageAsWellKnownAdmin();
	await enterApp(adminPage, INSTANCE_ORGANISATION.slug);
	const skipTour = adminPage.getByRole("button", {
		name: message("tour_card_skip_button"),
	});
	if (await skipTour.isVisible()) {
		await skipTour.click();
	}
	await adminPage
		.getByRole("button", {
			name: /E2E Admin/,
		})
		.click();
	const launcher = adminPage.getByRole("menuitem", {
		name: message("user_menu_manage_instance_item"),
	});
	await expect(launcher).toBeVisible();
	await launcher.click();
	await expect(adminPage).toHaveURL(/\/instance\/organizations/);

	const memberPage = await pageAs("member");
	await enterApp(memberPage, org.slug);
	await memberPage
		.getByRole("button", {
			name: /E2E member/,
		})
		.click();
	await expect(
		memberPage.getByRole("menuitem", {
			name: message("user_menu_manage_instance_item"),
		}),
	).toHaveCount(0);
});

test("admin browser and API sessions keep independent organisation selections", async ({
	api,
	org,
	orgs,
	pageAsWellKnownAdmin,
	appBaseURL,
}) => {
	const other = await orgs.create("Independent session scope");
	const page = await pageAsWellKnownAdmin();
	const cookies = await page.context().cookies();
	const browserClient = createApiClient(
		appBaseURL,
		cookies.map(({ name, value }) => `${name}=${value}`).join("; "),
	);
	// The API session is cached per worker, so what this test selects on it
	// outlives the test; the rest of the instance project expects the
	// instance organisation.
	const selected = await activeOrganizationOf(
		appBaseURL,
		await adminSession(appBaseURL),
	);

	try {
		await browserClient.user.setActiveOrganization({
			organizationId: other.id,
		});
		await api.asWellKnownAdmin().user.setActiveOrganization({
			organizationId: org.id,
		});
		const session = await (
			await page.request.get(`${appBaseURL}/api/auth/get-session`)
		).json();
		expect(session.session.activeOrganizationId).toBe(other.id);
		await browserClient.user.setActiveOrganization({
			organizationId: org.id,
		});
		await api.asWellKnownAdmin().user.setActiveOrganization({
			organizationId: other.id,
		});
		const unchanged = await (
			await page.request.get(`${appBaseURL}/api/auth/get-session`)
		).json();
		expect(unchanged.session.activeOrganizationId).toBe(org.id);
	} finally {
		if (selected) {
			await api.asWellKnownAdmin().user.setActiveOrganization({
				organizationId: organizationIdSchema.parse(selected),
			});
		}
	}
});
