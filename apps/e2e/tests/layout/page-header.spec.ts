import { untilAllowed } from "../../fixtures/authorization";
import { type ApiClient, expect, test } from "../../fixtures/index";
import { pageHeaderProblems } from "../../fixtures/layout/page-header";
import { enterApp, open } from "../../fixtures/navigation";
import { runId } from "../../fixtures/organisation";

const WIDTHS = [
	1280,
	390,
];

const LONG = (letter: string) => letter.repeat(96);

const createProvider = (admin: ApiClient) =>
	untilAllowed(() =>
		admin.provider.create({
			name: `${LONG("P")}${runId()}`,
			description: LONG("d"),
			endpoint: "http://127.0.0.1:9/v1",
			kind: "openai-compatible",
			meteringMode: "tokens",
			apiKey: "e2e-key",
			enabled: true,
		}),
	);

const createGroup = (admin: ApiClient) =>
	admin.group.create({
		name: `${LONG("G")}${runId()}`,
	});

const createQuotaPool = async (admin: ApiClient) => {
	const provider = await createProvider(admin);
	const groups = await admin.group.list({
		pageIndex: 0,
		pageSize: 100,
	});
	const allMembers = groups.data.find(
		(candidate) => candidate.systemKey === "all_members",
	);
	if (!allMembers) throw new Error("Missing All Members group");
	return await admin.quotaPool.create({
		name: `${LONG("Q")}${runId()}`,
		providerId: provider.data.id,
		periodType: "monthly",
		budgetAmount: 1000,
		groupIds: [
			allMembers.id,
		],
	});
};

// Each page in a test of its own, so a test's time stays flat, with only the
// long names it shows.
const PAGES: {
	readonly name: string;
	readonly path: (admin: ApiClient) => Promise<string> | string;
}[] = [
	{
		name: "Groups",
		path: async (admin) => {
			await createGroup(admin);
			return "/app/groups";
		},
	},
	{
		name: "a group",
		path: async (admin) => `/app/groups/${(await createGroup(admin)).data.id}`,
	},
	{
		name: "Models",
		path: () => "/app/models",
	},
	{
		name: "Providers",
		path: async (admin) => {
			await createProvider(admin);
			return "/app/providers";
		},
	},
	{
		name: "a provider",
		path: async (admin) =>
			`/app/providers/${(await createProvider(admin)).data.id}`,
	},
	{
		name: "Quota pools",
		path: async (admin) => {
			await createQuotaPool(admin);
			return "/app/quota-pools";
		},
	},
	{
		name: "a quota pool",
		path: async (admin) =>
			`/app/quota-pools/${(await createQuotaPool(admin)).data.id}`,
	},
	{
		name: "Members",
		path: () => "/app/members",
	},
	{
		name: "Chat",
		path: () => "/app/chat",
	},
	{
		name: "Analytics",
		path: () => "/app/analytics",
	},
];

for (const width of WIDTHS) {
	for (const { name, path } of PAGES) {
		test(`layout: the page header of ${name} keeps long names and focus rings inside the page at ${width} px`, async ({
			api,
			org,
			pageAs,
		}) => {
			const target = await path(api.as("admin"));
			const page = await pageAs("admin");
			await enterApp(page, org.slug);
			await page.setViewportSize({
				width,
				height: 900,
			});

			await open(page, target);
			await expect(
				page.locator("[data-slot=page-header]").first(),
			).toBeVisible();
			expect(await pageHeaderProblems(page)).toEqual([]);
		});
	}
}
