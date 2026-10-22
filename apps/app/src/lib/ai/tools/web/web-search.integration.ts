import { afterAll, describe, expect, test } from "bun:test";
import type { ProviderId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { serve } from "bun";
import { eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { authzIntegration, TIMEOUT } from "@/lib/authz/authz-integration";
import { Procedures } from "@/lib/orpc/implementation/procedures";
import { AssistantToolError } from "../tool-error";
import { turnWebSearch } from "./turn-web-search";

const { run, organizationWith, procedureOptions } = authzIntegration();

/** A Tavily stand-in that fails each search whose query starts with `fail`. */
const searches: string[] = [];
const tavily = serve({
	port: 0,
	fetch: async (request) => {
		const { query } = (await request.json()) as {
			query: string;
		};
		searches.push(query);
		if (query.startsWith("fail")) {
			return Response.json(
				{
					detail: {
						error: "This request exceeds your plan's set usage limit.",
					},
				},
				{
					status: 432,
				},
			);
		}
		return Response.json({
			query,
			results: [
				{
					url: "https://docs.example.org/orcas",
					title: "Orcas",
					content: `About ${query}.`,
					score: 0.9,
				},
				{
					url: "https://elsewhere.net/orcas",
					title: "Elsewhere",
					content: "Not on an allowed domain.",
					score: 0.8,
				},
			],
			response_time: 0.01,
		});
	},
});
afterAll(() => tavily.stop(true));

/** An organisation whose web search is a Tavily provider with a pool of `budget` searches for every member. */
const organizationWithSearch = async (budget: number) => {
	const {
		organizationId,
		actors: [admin, member],
		zedToken,
	} = await organizationWith([
		"admin",
		"member",
	]);
	const procedures = await run(Procedures);
	const [allMembers] = await run(
		Effect.gen(function* () {
			return yield* (yield* DB)
				.insert(dbSchema.group)
				.values({
					organizationId,
					name: "All Members",
					kind: "system",
					systemKey: "all_members",
					createdBy: admin.user.id,
				})
				.returning();
		}),
	);
	const { data: provider, meta } = await run(
		procedures.provider.create(
			{
				name: `Search ${crypto.randomUUID()}`,
				description: "Tavily stand-in.",
				kind: "tavily",
				endpoint: tavily.url.origin,
				apiKey: "tvly-key",
				meteringMode: "requests",
				enabled: true,
			},
			await procedureOptions(admin, zedToken),
		),
	);
	const asAdmin = () => procedureOptions(admin, meta?.zedToken ?? zedToken);
	await run(
		procedures.quota.create(
			{
				name: `Search pool ${crypto.randomUUID()}`,
				providerId: provider.id,
				periodType: "monthly",
				budgetAmount: budget,
				groupIds: [
					allMembers.id,
				],
			},
			await asAdmin(),
		),
	);
	const { meta: updated } = await run(
		procedures.organization.update(
			{
				id: organizationId,
				webSearch: {
					mode: "provider",
					providerId: provider.id,
				},
			},
			await asAdmin(),
		),
	);

	const memberOptions = await procedureOptions(
		member,
		updated?.zedToken ?? meta?.zedToken ?? zedToken,
	);
	const { data: bot } = await run(
		procedures.bot.save(
			{
				name: `Searching bot ${crypto.randomUUID()}`,
				description: "Integration bot",
				status: "draft",
			},
			memberOptions,
		),
	);
	const webSearch = await run(
		turnWebSearch({
			organizationId,
			userId: member.user.id,
			botId: bot.id,
			modelKind: "openai-compatible",
			context: memberOptions.context,
		}),
	);

	return {
		organizationId,
		providerId: provider.id,
		botId: bot.id,
		webSearch,
		asAdmin,
	};
};

const search = (
	webSearch: Awaited<ReturnType<typeof organizationWithSearch>>["webSearch"],
	query: string,
) => {
	if (webSearch.kind !== "provider") {
		throw new Error(`Expected search by provider, got ${webSearch.kind}`);
	}
	return run(
		webSearch
			.search({
				query,
				allowedDomains: [
					"example.org",
				],
				maxResults: 5,
			})
			.pipe(Effect.result),
	);
};

/** The provider's ledger and terminal usage events. */
const metering = (providerId: ProviderId) =>
	run(
		Effect.gen(function* () {
			const db = yield* DB;
			const [ledger] = yield* db
				.select({
					consumed: dbSchema.quotaLedger.consumedAmount,
					reserved: dbSchema.quotaLedger.reservedAmount,
				})
				.from(dbSchema.quotaLedger)
				.innerJoin(
					dbSchema.quotaPool,
					eq(dbSchema.quotaPool.id, dbSchema.quotaLedger.quotaPoolId),
				)
				.where(eq(dbSchema.quotaPool.providerId, providerId));
			const events = yield* db
				.select({
					botId: dbSchema.quotaUsageEvent.botId,
				})
				.from(dbSchema.quotaUsageEvent)
				.where(eq(dbSchema.quotaUsageEvent.providerId, providerId));
			return {
				consumed: Number(ledger?.consumed),
				reserved: Number(ledger?.reserved),
				botIds: [
					...new Set(events.map((event) => event.botId)),
				],
			};
		}),
	);

describe("web search by a search provider", () => {
	test(
		"charges one request per answered search and returns only allowed pages",
		async () => {
			const { providerId, botId, webSearch } = await organizationWithSearch(5);

			const answered = await search(webSearch, "orca pods");

			expect(answered._tag === "Success" && answered.success).toEqual([
				{
					url: "https://docs.example.org/orcas",
					title: "Orcas",
					content: "About orca pods.",
				},
			]);
			expect(await metering(providerId)).toEqual({
				consumed: 1,
				reserved: 0,
				botIds: [
					botId,
				],
			});
		},
		TIMEOUT,
	);

	test(
		"gives the request back when the provider fails",
		async () => {
			const { providerId, webSearch } = await organizationWithSearch(5);

			const failed = await search(webSearch, "fail please");

			expect(failed._tag).toBe("Failure");
			expect(failed._tag === "Failure" && failed.failure).toEqual(
				new AssistantToolError(
					"WEB_SEARCH_FAILED: This request exceeds your plan's set usage limit.",
				),
			);
			expect(await metering(providerId)).toMatchObject({
				consumed: 0,
				reserved: 0,
			});
		},
		TIMEOUT,
	);

	test(
		"tells the model the quota is used up and does not call the provider",
		async () => {
			const { providerId, webSearch } = await organizationWithSearch(1);
			await search(webSearch, "first");
			const searchesBefore = searches.length;

			const denied = await search(webSearch, "second");

			expect(denied._tag).toBe("Failure");
			expect(denied._tag === "Failure" && denied.failure.message).toStartWith(
				"QUOTA_EXHAUSTED: ",
			);
			expect(searches.length).toBe(searchesBefore);
			expect(await metering(providerId)).toMatchObject({
				consumed: 1,
				reserved: 0,
			});
		},
		TIMEOUT,
	);
});

test(
	"deleting the search provider turns web search off",
	async () => {
		const { organizationId, providerId, asAdmin } =
			await organizationWithSearch(5);
		const procedures = await run(Procedures);

		await run(
			procedures.provider.delete(
				{
					refs: [
						{
							id: providerId,
						},
					],
				},
				await asAdmin(),
			),
		);

		const { data } = await run(
			procedures.organization.find(
				{
					id: organizationId,
				},
				await asAdmin(),
			),
		);
		expect(data).toMatchObject({
			webSearchMode: "off",
			webSearchProviderId: null,
		});
	},
	TIMEOUT,
);
