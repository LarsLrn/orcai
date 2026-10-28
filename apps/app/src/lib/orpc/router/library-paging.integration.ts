import { describe, expect, test } from "bun:test";
import { DB, dbSchema } from "@orcai/db";
import { PgBossService } from "@orcai/pg-boss";
import { PROCESS_ASSET_JOB_NAME } from "@orcai/schema";
import { inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { authzIntegration, TIMEOUT } from "@/lib/authz/authz-integration";
import { Procedures } from "@/lib/orpc/implementation/procedures";

const { run, organizationWith, procedureOptions } = authzIntegration();

const COUNT = 5;
const PAGE_SIZE = 2;
const SAME_INSTANT = new Date("2026-01-01T00:00:00.000Z");

const content = "Uploaded by the library paging integration test.";

/** A member of a fresh organization and the procedures they call. */
const member = async () => {
	const {
		actors: [actor],
		zedToken,
	} = await organizationWith([
		"member",
	]);
	const procedures = await run(Procedures);
	// Workers create their queues at boot; the tier runs none.
	await run(
		Effect.gen(function* () {
			const { boss } = yield* PgBossService;
			yield* Effect.promise(() => boss.createQueue(PROCESS_ASSET_JOB_NAME));
		}),
	);
	return {
		procedures,
		options: (token = zedToken) => procedureOptions(actor, token),
	};
};

/** Gives every row the same creation time, as a bulk import does. */
const stampSameInstant = (
	table: typeof dbSchema.asset | typeof dbSchema.block,
	ids: string[],
) =>
	run(
		Effect.gen(function* () {
			yield* (yield* DB)
				.update(table)
				.set({
					createdAt: SAME_INSTANT,
				})
				.where(inArray(table.id, ids as never[]));
		}),
	);

/** Reads every page of a list; ties on the creation time break by id, newest first. */
const expectPagesInTieOrder = async (
	listPage: (pageIndex: number) => Promise<string[]>,
	ids: string[],
) => {
	const seen: string[] = [];
	for (let pageIndex = 0; pageIndex * PAGE_SIZE < COUNT; pageIndex++) {
		seen.push(...(await listPage(pageIndex)));
	}

	expect(seen).toEqual(
		[
			...ids,
		]
			.sort()
			.reverse(),
	);
};

describe("library lists with equal creation times", () => {
	test(
		"block pages follow id order on equal creation times",
		async () => {
			const { procedures, options } = await member();
			let zedToken: string | undefined;
			const ids: string[] = [];
			for (let index = 0; index < COUNT; index++) {
				const block = await run(
					procedures.block.create(
						{
							type: "template",
							name: `Paging behaviour ${index}`,
							description: null,
							contentJson: null,
							contentHtml: null,
							status: "ready",
							config: {
								systemPrompt: "Paging prompt",
							},
						},
						await options(zedToken),
					),
				);
				ids.push(block.data.id);
				zedToken = block.meta?.zedToken ?? zedToken;
			}
			await stampSameInstant(dbSchema.block, ids);

			await expectPagesInTieOrder(async (pageIndex) => {
				const { data } = await run(
					procedures.block.list(
						{
							pageIndex,
							pageSize: PAGE_SIZE,
							filters: {
								type: "template",
								status: "ready",
							},
						},
						await options(zedToken),
					),
				);
				return data.map((block) => block.id);
			}, ids);
		},
		TIMEOUT,
	);

	test(
		"asset pages follow id order on equal creation times",
		async () => {
			const { procedures, options } = await member();
			let zedToken: string | undefined;
			const ids: string[] = [];
			for (let index = 0; index < COUNT; index++) {
				const signed = await run(
					procedures.storage.createUploadUrls(
						{
							route: "asset",
							files: [
								{
									name: `paging-${index}.txt`,
									size: content.length,
									type: "text/plain",
								},
							],
						},
						await options(zedToken),
					),
				);
				const [target] = signed.data;
				if (target?.mode !== "single") {
					throw new Error("Expected a single upload");
				}
				const response = await fetch(target.signedUrl, {
					method: "PUT",
					headers: target.headers,
					body: content,
				});
				expect(response.ok).toBe(true);

				const created = await run(
					procedures.asset.createFromUploads(
						{
							route: "asset",
							files: [
								target.file,
							],
						},
						await options(zedToken),
					),
				);
				const [result] = created.data;
				if (result?.status !== "created") {
					throw new Error(`Expected a created asset, got ${result?.status}`);
				}
				ids.push(result.asset.id);
				zedToken = created.meta?.zedToken ?? zedToken;
			}
			await stampSameInstant(dbSchema.asset, ids);

			await expectPagesInTieOrder(async (pageIndex) => {
				const { data } = await run(
					procedures.asset.list(
						{
							pageIndex,
							pageSize: PAGE_SIZE,
							filters: {
								origin: "library",
							},
						},
						await options(zedToken),
					),
				);
				return data.map((asset) => asset.id);
			}, ids);
		},
		TIMEOUT,
	);
});
