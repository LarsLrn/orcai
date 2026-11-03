import { describe, expect, test } from "bun:test";
import { DB, dbSchema } from "@orcai/db";
import { inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { Procedures } from "@/lib/orpc/implementation/procedures";
import { appIntegration, TIMEOUT } from "@/lib/testing/app-integration";

const { run, caller, organizationWith } = appIntegration();

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
	const { call } = caller(zedToken);
	return {
		actor,
		procedures,
		call,
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
			const { actor, procedures, call } = await member();
			const ids: string[] = [];
			for (let index = 0; index < COUNT; index++) {
				const block = await call(actor, (options) =>
					procedures.block.create(
						{
							type: "behaviour",
							name: `Paging behaviour ${index}`,
							description: null,
							contentJson: null,
							status: "ready",
							config: {
								systemPrompt: "Paging prompt",
							},
						},
						options,
					),
				);
				ids.push(block.data.id);
			}
			await stampSameInstant(dbSchema.block, ids);

			await expectPagesInTieOrder(async (pageIndex) => {
				const { data } = await call(actor, (options) =>
					procedures.block.list(
						{
							pageIndex,
							pageSize: PAGE_SIZE,
							filters: {
								type: "behaviour",
								status: "ready",
							},
						},
						options,
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
			const { actor, procedures, call } = await member();
			const ids: string[] = [];
			for (let index = 0; index < COUNT; index++) {
				const signed = await call(actor, (options) =>
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
						options,
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

				const created = await call(actor, (options) =>
					procedures.asset.createFromUploads(
						{
							route: "asset",
							files: [
								target.file,
							],
						},
						options,
					),
				);
				const [result] = created.data;
				if (result?.status !== "created") {
					throw new Error(`Expected a created asset, got ${result?.status}`);
				}
				ids.push(result.asset.id);
			}
			await stampSameInstant(dbSchema.asset, ids);

			await expectPagesInTieOrder(async (pageIndex) => {
				const { data } = await call(actor, (options) =>
					procedures.asset.list(
						{
							pageIndex,
							pageSize: PAGE_SIZE,
							filters: {
								keptIn: "library",
							},
						},
						options,
					),
				);
				return data.map((asset) => asset.id);
			}, ids);
		},
		TIMEOUT,
	);
});
