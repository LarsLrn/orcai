import { randomUUID } from "node:crypto";
import { untilAllowed } from "../../fixtures/authorization";
import { createGroupThroughUi } from "../../fixtures/groups/groups";
import { expect, test } from "../../fixtures/index";
import { enterApp, open } from "../../fixtures/navigation";

test("group UI creation finds an existing group beyond page one", async ({
	api,
	org,
	pageAs,
}) => {
	const client = api.as("admin");
	const name = `Duplicate target ${randomUUID()}`;
	await untilAllowed(() =>
		client.group.create({
			name,
		}),
	);
	for (let index = 0; index < 12; index++)
		await client.group.create({
			name: `Newer group ${index} ${randomUUID()}`,
		});
	const page = await pageAs("admin");
	await enterApp(page, org.slug);
	await open(page, "/en/app/groups?pageSize=5");
	await createGroupThroughUi(page, name);
	const matches = await client.group.list({
		filters: {
			search: name,
		},
		pageIndex: 0,
		pageSize: 100,
	});
	expect(matches.data.map((group) => group.name)).toEqual([
		name,
	]);
});
