import { untilAllowed } from "../../fixtures/authorization";
import { expect, test } from "../../fixtures/index";
import { pageHeaderProblems } from "../../fixtures/layout/page-header";
import { enterApp, open } from "../../fixtures/navigation";
import { runId } from "../../fixtures/organisation";

const WIDTHS = [
	1280,
	390,
];

const LONG = (letter: string) => letter.repeat(96);

for (const width of WIDTHS) {
	test(`layout: page headers keep long names and focus rings inside the page at ${width} px`, async ({
		api,
		org,
		pageAs,
	}) => {
		const admin = api.as("admin");
		const run = runId();
		const provider = await untilAllowed(() =>
			admin.provider.create({
				name: `${LONG("P")}${run}`,
				description: LONG("d"),
				endpoint: "http://127.0.0.1:9/v1",
				kind: "openai-compatible",
				meteringMode: "tokens",
				apiKey: "e2e-key",
				enabled: true,
			}),
		);
		const group = await admin.group.create({
			name: `${LONG("G")}${run}`,
		});
		const groups = await admin.group.list({
			pageIndex: 0,
			pageSize: 100,
		});
		const allMembers = groups.data.find(
			(candidate) => candidate.systemKey === "all_members",
		);
		if (!allMembers) throw new Error("Missing All Members group");
		const pool = await admin.quota.create({
			name: `${LONG("Q")}${run}`,
			providerId: provider.data.id,
			periodType: "monthly",
			budgetAmount: 1000,
			groupIds: [
				allMembers.id,
			],
		});

		const page = await pageAs("admin");
		await enterApp(page, org.slug);
		await page.setViewportSize({
			width,
			height: 900,
		});

		const paths = [
			"/app/groups",
			"/app/models",
			"/app/providers",
			"/app/quotas",
			"/app/members",
			"/app/chat",
			"/app/analytics",
			`/app/groups/${group.data.id}`,
			`/app/providers/${provider.data.id}`,
			`/app/quotas/${pool.data.id}`,
		];
		for (const path of paths) {
			await open(page, path);
			await expect(
				page.locator("[data-slot=page-header]").first(),
			).toBeVisible();
			expect(await pageHeaderProblems(page), path).toEqual([]);
		}
	});
}
