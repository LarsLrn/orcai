import { expectDenied } from "../../fixtures/authorization";
import { ROLES } from "../../fixtures/constants";
import { expect, test } from "../../fixtures/index";
import { runId } from "../../fixtures/organisation";

/**
 * A template block is the one resource with visibility that a test can create
 * through the API alone: a bot needs a model and an asset needs the upload and
 * the background workers, neither of which an e2e run has.
 */
const templateBlock = (name: string) => ({
	type: "template" as const,
	name,
	status: "ready" as const,
	config: {
		systemPrompt: "Created by the tenancy visibility seam test.",
	},
});

const blockIds = async (
	list: Promise<{
		data: {
			id: string;
		}[];
	}>,
) => (await list).data.map((block) => block.id);

test("a private block is hidden from another member of the organisation until it is public", async ({
	api,
}) => {
	const created = await api
		.as("member")
		.block.create(templateBlock(`E2E Private Block ${runId()}`));
	const resourceId = created.data.id;

	const visibility = await api.as("member").resource.getVisibility({
		resourceType: "block",
		resourceId,
	});
	expect(visibility.data.visibility).toBe("private");

	// The manager of the same organisation was granted nothing on the block.
	await expectDenied(
		api.as("manager").block.find({
			id: resourceId,
		}),
	);
	expect(
		await blockIds(
			api.as("manager").block.list({
				pageIndex: 0,
				pageSize: 100,
			}),
		),
	).not.toContain(resourceId);

	const madePublic = await api.as("member").resource.setVisibility({
		resourceType: "block",
		resourceId,
		visibility: "public",
	});
	const zedToken = madePublic.meta?.zedToken;

	const found = await api.as("manager").block.find({
		id: resourceId,
	});
	expect(found.data.id).toBe(resourceId);

	// Blocks come back newest first, so a block created in this test is on the
	// first page whatever else the run has accumulated. `block.list` takes its
	// revision from the input, so the listing carries the token of the change.
	expect(
		await blockIds(
			api.as("manager").block.list({
				pageIndex: 0,
				pageSize: 100,
				zedToken,
			}),
		),
	).toContain(resourceId);
});

test("a private block is hidden from another organisation", async ({
	api,
	orgs,
}) => {
	const other = await orgs.create("E2E Visibility Neighbour");

	const created = await api
		.as("member")
		.block.create(templateBlock(`E2E Shared Block ${runId()}`));
	const resourceId = created.data.id;

	for (const role of ROLES) {
		await expectDenied(
			api.as(role, other).block.find({
				id: resourceId,
			}),
		);
		expect(
			await blockIds(
				api.as(role, other).block.list({
					pageIndex: 0,
					pageSize: 100,
				}),
			),
		).not.toContain(resourceId);
	}
});

test("a public block is readable from another organisation", async ({
	api,
	orgs,
}) => {
	const other = await orgs.create("E2E Visibility Neighbour Reader");

	const created = await api
		.as("member")
		.block.create(templateBlock(`E2E Public Block ${runId()}`));
	const resourceId = created.data.id;

	const madePublic = await api.as("member").resource.setVisibility({
		resourceType: "block",
		resourceId,
		visibility: "public",
	});
	const zedToken = madePublic.meta?.zedToken;

	// The owner's own organisation reaches it, which is the point of public.
	await api.as("manager").block.find({
		id: resourceId,
	});

	/** Public is instance-wide: every role in another organisation can read and
	 * list it, while the owning organisation's providers, models, and quotas
	 * remain local. */
	for (const role of ROLES) {
		const found = await api.as(role, other).block.find({
			id: resourceId,
		});
		expect(found.data.id).toBe(resourceId);

		/** Blocks come back newest first, so the block this test created is on
		 * the first page whatever else the run has accumulated. `block.list`
		 * takes its revision from the input, so the listing carries the token
		 * of the change. */
		expect(
			await blockIds(
				api.as(role, other).block.list({
					pageIndex: 0,
					pageSize: 100,
					zedToken,
				}),
			),
		).toContain(resourceId);
	}
});
