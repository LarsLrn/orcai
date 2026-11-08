import { createApiClient } from "../../fixtures/api";
import { baseURL } from "../../fixtures/env";
import { expect, test } from "../../fixtures/index";
import { enterApp, open } from "../../fixtures/navigation";
import { addMember, createUser } from "../../fixtures/users";

test("members: a user in two organisations switches the active one", async ({
	api,
	orgs,
	pageForSession,
	seedZedToken,
	zedTokens,
}) => {
	const org = await orgs.create("E2E Users First");
	const second = await orgs.create("E2E Users Second");
	const user = await createUser("two-orgs");
	await addMember(api.as("admin", org), {
		user,
		role: "member",
		zedTokens,
	});
	await addMember(api.as("admin", second), {
		user,
		role: "member",
		zedTokens,
	});

	const client = createApiClient(
		baseURL(),
		user.session.cookieHeader,
		zedTokens,
	);

	const me = await client.user.me({});
	expect(me.data.id).toBe(user.id);
	expect(me.data.email).toBe(user.email);
	expect(me.data.name).toBe(user.name);

	// `organizationMember.listAccess` lists resource access inside the active organisation,
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

	const access = await client.organizationMember.listAccess({
		userId: user.id,
	});
	// This user owns nothing and was granted nothing, so it holds no access of
	// its own. Public means visible to every signed-in user of the instance,
	// so a public resource a parallel worker created is listed here too: what
	// the assertion pins is the absence of any other origin.
	expect(
		access.data
			.filter((entry) => entry.origin !== "public")
			.map((entry) => entry.origin),
	).toEqual([]);

	const page = await pageForSession(user.session);

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
	await open(page, "/app");
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
});
