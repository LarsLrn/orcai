import { createApiClient } from "../../fixtures/api";
import { pageForSession } from "../../fixtures/auth/users";
import { baseURL } from "../../fixtures/env";
import { expect, test } from "../../fixtures/index";
import { enterApp, open } from "../../fixtures/navigation";
import { addMember, createThrowawayUser } from "../../fixtures/users/users";

test("users: a user in two organisations switches the active one", async ({
	api,
	browser,
	orgs,
	seedZedToken,
	zedTokens,
}) => {
	const org = await orgs.create("E2E Users First");
	const second = await orgs.create("E2E Users Second");
	const user = await createThrowawayUser(baseURL(), "two-orgs");
	await addMember(api, org, user, "member", zedTokens);
	await addMember(api, second, user, "member", zedTokens);

	const client = createApiClient(
		baseURL(),
		user.session.cookieHeader,
		zedTokens,
	);

	const me = await client.user.me({});
	expect(me.data.id).toBe(user.id);
	expect(me.data.email).toBe(user.email);
	expect(me.data.name).toBe(user.name);

	// `user.listAccess` lists resource access inside the active organisation,
	// not the organisations themselves, so it needs one to be active. The
	// organisations a user reaches come from `organization.list`.
	await client.user.setActiveOrganization({
		organizationId: org.id,
	});

	const memberships = await client.organization.list({
		pageIndex: 0,
		pageSize: 100,
	});
	expect(memberships.data.map((organisation) => organisation.slug)).toEqual(
		expect.arrayContaining([
			org.slug,
			second.slug,
		]),
	);

	const access = await client.user.listAccess({
		id: user.id,
	});
	// This user owns nothing and was granted nothing, so it holds no access of
	// its own. Public means visible to every signed-in user of the instance,
	// so a public resource a parallel worker created is listed here too: what
	// the assertion pins is the absence of any other source.
	expect(
		access.data
			.filter((entry) => entry.source !== "public")
			.map((entry) => entry.source),
	).toEqual([]);

	const { context, page } = await pageForSession(browser, user.session);

	try {
		await seedZedToken(page);
		await enterApp(page, org.slug);

		await expect(
			page.getByRole("button", {
				name: org.name,
			}),
		).toBeVisible();

		// The page and this client share one session, so switching the active
		// organisation through the API is what the app itself does and the
		// next load reads the other organisation everywhere.
		const switched = await client.user.setActiveOrganization({
			organizationId: second.id,
		});
		expect(switched.success).toBe(true);

		await seedZedToken(page);
		await open(page, "/en/app");
		await expect(
			page.getByRole("button", {
				name: second.name,
			}),
		).toBeVisible();
		await expect(
			page.getByRole("button", {
				name: org.name,
			}),
		).toHaveCount(0);
	} finally {
		await context.close();
	}
});
