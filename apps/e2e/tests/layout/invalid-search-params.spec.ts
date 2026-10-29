import { untilAllowed } from "../../fixtures/authorization";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";
import { runId } from "../../fixtures/organisation";

/** Routes whose table shows its page and page size. */
const TABLE_PATHS = [
	"/app/groups",
	"/app/members",
	"/app/members/invitations",
	"/app/providers",
	"/app/quotas",
];

const OTHER_PATHS = [
	"/app/models",
	"/app/chat",
	"/app/library/bots",
	"/history",
];

const INVALID_SEARCHES = [
	"pageIndex=-1&pageSize=abc",
	"pageSize=5000&pageIndex=x",
	"pageIndex=0.5&pageSize=1.5",
	"pageIndex=1e100",
];

for (const path of [
	...TABLE_PATHS,
	...OTHER_PATHS,
]) {
	test(`layout: ${path} falls back on invalid paging search params`, async ({
		api,
		org,
		pageAs,
	}) => {
		const admin = api.as("admin");

		if (path === "/app/providers" || path === "/app/quotas") {
			const provider = await untilAllowed(() =>
				admin.provider.create({
					name: `Paging ${runId()}`,
					description: "Paging",
					endpoint: "http://127.0.0.1:9/v1",
					kind: "openai-compatible",
					meteringMode: "tokens",
					apiKey: "e2e-key",
					enabled: true,
				}),
			);
			const groups = await admin.group.list({
				pageIndex: 0,
				pageSize: 100,
			});
			const allMembers = groups.data.find(
				(candidate) => candidate.systemKey === "all_members",
			);
			if (!allMembers) throw new Error("Missing All Members group");
			await admin.quota.create({
				name: `Paging ${runId()}`,
				providerId: provider.data.id,
				periodType: "monthly",
				budgetAmount: 1000,
				groupIds: [
					allMembers.id,
				],
			});
		}

		const page = await pageAs("admin");
		await enterApp(page, org.slug);

		const pagePrefix = message("data_table_pagination_position", {
			page: 1,
			pageCount: 1,
		}).slice(0, -1);

		for (const search of INVALID_SEARCHES) {
			const url = `${path}?${search}`;
			await open(page, url);
			await expect(page.locator("main").first(), url).toBeVisible();
			await expect(
				page.getByText(message("boundaries_default_error_title")),
				url,
			).toHaveCount(0);

			if (!TABLE_PATHS.includes(path)) {
				continue;
			}
			await expect(page.getByText(pagePrefix), url).toBeVisible();
			await expect(
				page
					.getByText(message("data_table_pagination_rows_per_page_label"))
					.locator("xpath=following-sibling::*[@role='combobox']"),
				url,
			).toContainText("20");
		}
	});
}
