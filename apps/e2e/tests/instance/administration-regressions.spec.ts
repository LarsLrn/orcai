import { randomUUID } from "node:crypto";
import { organizationIdSchema } from "@orcai/schema";
import { createApiClient } from "../../fixtures/api";
import { activeOrganizationOf, signIn } from "../../fixtures/auth";
import {
	INSTANCE_ORGANISATION,
	USER_PASSWORD,
	WELL_KNOWN_ADMIN,
} from "../../fixtures/constants";
import { expect, test } from "../../fixtures/index";
import { enterApp, open } from "../../fixtures/navigation";
import { adminSession, signUpUnaffiliated } from "../../fixtures/organisation";

test("instance management has an independent route and survives the last organisation", async ({
	appBaseURL,
	browser,
}) => {
	test.slow();
	const session = await signUpUnaffiliated({
		baseURL: appBaseURL,
		email: `instance-${randomUUID()}@e2e.orcai.test`,
		name: "Independent administrator",
	});
	const admin = await signIn(appBaseURL, WELL_KNOWN_ADMIN);
	const setRole = (role: string) =>
		fetch(`${appBaseURL}/api/auth/admin/set-role`, {
			method: "POST",
			headers: {
				cookie: admin.cookieHeader,
				origin: appBaseURL,
				"content-type": "application/json",
			},
			body: JSON.stringify({
				userId: session.userId,
				role,
			}),
		});
	for (const role of [
		"admin,user",
		"owner",
		"",
		"user,admin",
	])
		expect((await setRole(role)).ok).toBe(false);
	expect((await setRole("user")).ok).toBe(true);
	const ordinary = await browser.newContext({
		storageState: session.storageState,
	});
	try {
		const page = await ordinary.newPage();
		await open(page, "/en/instance/organizations");
		await expect(page).toHaveURL(/\/en\/select-organization/);
		await expect(
			page.getByRole("link", {
				name: "Manage instance",
			}),
		).toHaveCount(0);
	} finally {
		await ordinary.close();
	}
	expect((await setRole("admin")).ok).toBe(true);
	const promoted = await signIn(appBaseURL, {
		email: session.email,
		password: USER_PASSWORD,
	});
	const client = createApiClient(appBaseURL, promoted.cookieHeader);
	const context = await browser.newContext({
		storageState: promoted.storageState,
	});
	try {
		const page = await context.newPage();
		await open(page, "/en/select-organization");
		await expect(
			page.getByRole("link", {
				name: "Manage instance",
			}),
		).toBeVisible();

		await open(page, "/en/instance");
		await expect(page).toHaveURL(/\/en\/instance\/organizations/);
		await expect(
			page.getByRole("heading", {
				name: "Organisations",
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

		await open(page, "/en/instance/users");
		await expect(
			page.getByRole("heading", {
				name: "Users",
				exact: true,
			}),
		).toBeVisible();
		expect(await activeOrganizationOf(appBaseURL, promoted)).toBe(id);

		await page
			.getByRole("link", {
				name: "Back to app",
			})
			.click();
		await expect(page).toHaveURL(/\/en\/app(?:\/|$)/);
		await expect(
			page.getByRole("button", {
				name: "Only organisation",
			}),
		).toBeVisible();

		await open(page, "/en/app/instance/organizations");
		await expect(
			page.getByRole("heading", {
				name: "Page Not Found",
			}),
		).toBeVisible();

		await open(page, "/en/instance/organizations");
		await client.organization.delete({
			refs: [
				{
					id,
				},
			],
		});
		await open(page, "/en/instance/users");
		await expect(
			page.getByRole("heading", {
				name: "Users",
				exact: true,
			}),
		).toBeVisible();

		await page
			.getByRole("link", {
				name: "Back to app",
			})
			.click();
		await expect(page).toHaveURL(/\/en\/select-organization/);
	} finally {
		await context.close();
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
		name: "Skip",
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
		name: "Manage instance",
	});
	await expect(launcher).toBeVisible();
	await launcher.click();
	await expect(adminPage).toHaveURL(/\/en\/instance\/organizations/);

	const memberPage = await pageAs("member");
	await enterApp(memberPage, org.slug);
	await memberPage
		.getByRole("button", {
			name: /E2E member/,
		})
		.click();
	await expect(
		memberPage.getByRole("menuitem", {
			name: "Manage instance",
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
