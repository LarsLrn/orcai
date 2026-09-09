import { createApiClient, ZED_TOKEN_COOKIE } from "../../fixtures/api";
import { expectForbidden, untilAllowed } from "../../fixtures/authorization";
import { submitForm } from "../../fixtures/forms";
import { expect, test } from "../../fixtures/index";
import { enterApp, open } from "../../fixtures/navigation";
import { runId } from "../../fixtures/organisation";

/** A name no other test uses, so a spec finds its own block. */
const authzName = (label: string) => `E2E Authz ${label} ${runId()}`;

/** A cookie header stripped of the revision the sign-up response handed out. */
const withoutZedToken = (cookieHeader: string) =>
	cookieHeader
		.split("; ")
		.filter((cookie) => !cookie.startsWith(`${ZED_TOKEN_COOKIE}=`))
		.join("; ");

/** A template block, the one grantable resource that needs no model, provider, or worker. */
const templateBlock = (name: string) => ({
	type: "template" as const,
	name,
	status: "ready" as const,
	config: {
		systemPrompt: "Created by the authz freshness slice.",
	},
});

test("a grant made over the API is visible on the first page load of the granted role", async ({
	api,
	org,
	pageAs,
}) => {
	const blockName = authzName("First Load Block");
	const block = await api.as("member").block.create(templateBlock(blockName));

	// The owner grants: `manage_access` on a block is its owner plus a manager.
	await api.as("member").resource.grant({
		resourceType: "block",
		resourceId: block.data.id,
		principals: [
			{
				principalType: "user",
				principalId: org.users.viewer.id,
			},
		],
		role: "viewer",
	});

	// The context carries this test's zedToken, so the loader's read is at
	// least as fresh as the grant.
	const page = await pageAs("viewer");
	await enterApp(page, org.slug);
	await open(page, `/en/app/hub/blocks/${block.data.id}`);

	await expect(
		page.getByRole("heading", {
			name: blockName,
		}),
	).toBeVisible();
});

test("a grant and a revoke are both readable over the API without waiting", async ({
	api,
	org,
}) => {
	const block = await api
		.as("member")
		.block.create(templateBlock(authzName("Immediate Read Block")));
	const resourceId = block.data.id;

	await api.as("member").resource.grant({
		resourceType: "block",
		resourceId,
		principals: [
			{
				principalType: "user",
				principalId: org.users.viewer.id,
			},
		],
		role: "viewer",
	});

	const found = await api.as("viewer").block.find({
		id: resourceId,
	});
	expect(found.data.id).toBe(resourceId);

	await api.as("member").resource.revoke({
		resourceType: "block",
		resourceId,
		principalType: "user",
		principalId: org.users.viewer.id,
	});

	// The permission middleware refuses before the block is looked up, so a
	// closed block is forbidden rather than missing.
	await expectForbidden(
		api.as("viewer").block.find({
			id: resourceId,
		}),
	);
});

test("a session that has never seen a zedToken still reads what it was granted", async ({
	appBaseURL,
	org,
}) => {
	// Its own empty token memory and no `zed_token` cookie either, so this
	// client names no revision and reads at the near-real-time snapshot.
	const viewer = createApiClient(
		appBaseURL,
		withoutZedToken(org.cookieHeaders.viewer),
	);

	// Naming no revision is the one path that may lag, so this read is the only
	// one in the file that is repeated.
	const members = await untilAllowed(() =>
		viewer.organizationMember.list({
			organizationId: org.id,
			pageIndex: 0,
			pageSize: 100,
		}),
	);

	expect(members.data.map((member) => member.userId)).toContain(
		org.users.viewer.id,
	);
});

test("a block created in the browser is readable on the page the creation navigates to", async ({
	org,
	pageAs,
}) => {
	test.slow();

	const blockName = authzName("Browser Created Block");
	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await open(page, "/en/app/hub/blocks/add");

	// Creating the block writes the owner relationship, and the response carries
	// the zedToken back as a cookie the page keeps.
	await submitForm(page, {
		fill: async () => {
			await page.getByLabel("Name").fill(blockName);
			await page
				.getByLabel("System Prompt")
				.fill("Created through the browser by the authz freshness slice.");
		},
		submit: "Save AI Behaviour",
		// The created block, not the add page it was submitted from.
		until: /\/en\/app\/hub\/blocks\/(?!add$)[^/]+$/,
	});

	// The page the creation navigates to reads the block behind a permission
	// check. Nothing seeds a zedToken here, so only the cookie the creation set
	// can make this first read see the owner relationship.
	await expect(
		page.getByRole("heading", {
			name: blockName,
		}),
	).toBeVisible();
	await expect(
		page.getByRole("button", {
			name: "Try Again",
		}),
	).toHaveCount(0);
});
