import { expect, test } from "bun:test";
import { type AssetId, buckets } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { cleanUpDueDeletions } from "@orcai/preparation";
import { assetObjectKey, processedAssetPrefix } from "@orcai/s3";
import {
	isS3NotFound,
	S3Service,
	sendDeleteObjectCommand,
	sendHeadObjectCommand,
	sendPutObjectCommand,
} from "@orcai/s3/server";
import { eq, sql } from "drizzle-orm";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { Procedures } from "@/lib/orpc/implementation/procedures";
import { appIntegration, TIMEOUT } from "@/lib/testing/app-integration";

const { run, organizationWith, createAsset, procedureOptions } =
	appIntegration();

/** The deletion's cleanup is due again, as once its retry delay has passed. */
const cleanupComesDue = (assetId: AssetId) =>
	Effect.gen(function* () {
		yield* (yield* DB)
			.update(dbSchema.deletionCleanup)
			.set({
				nextAttemptAt: new Date(0),
			})
			.where(
				sql`${dbSchema.deletionCleanup.data} -> 'files' @> ${JSON.stringify([
					{
						id: assetId,
					},
				])}::jsonb`,
			);
	});

/** The keys of `objects` still in storage. */
const stored = async (
	objects: readonly {
		bucket: string;
		key: string;
	}[],
) => {
	const keys: string[] = [];
	for (const object of objects) {
		const exists = await run(
			sendHeadObjectCommand(object).pipe(
				Effect.as(true),
				Effect.catchIf(isS3NotFound, () => Effect.succeed(false)),
			),
		);
		if (exists) keys.push(object.key);
	}
	return keys;
};

test(
	"a committed asset deletion removes its original and processed files once storage is back",
	async () => {
		const {
			organizationId,
			actors: [owner],
		} = await organizationWith([
			"member",
		]);
		const { asset, zedToken } = await createAsset(owner, organizationId);
		const p = await run(Procedures);
		const s3 = await run(S3Service);
		await run(s3.ensureBuckets);
		const objects = [
			{
				bucket: asset.bucket,
				key: assetObjectKey(asset),
			},
			{
				bucket: buckets.processed.name,
				key: `${processedAssetPrefix(asset.id)}extracted.txt`,
			},
		];
		try {
			for (const object of objects)
				await run(
					sendPutObjectCommand({
						...object,
						body: "recover me",
						contentType: "text/plain",
					}),
				);
			const options = await procedureOptions(owner, zedToken);
			let cleanupAttempts = 0;
			const failing = {
				...s3,
				client: new Proxy(s3.client, {
					get(target, key) {
						if (key === "send")
							return () => {
								cleanupAttempts++;
								return Promise.reject(new Error("injected cleanup outage"));
							};
						return Reflect.get(target, key);
					},
				}),
			};
			const injected = {
				...options,
				context: {
					...options.context,
					"effect/context": Context.add(
						options.context["effect/context"],
						S3Service,
						failing,
					),
				},
			};
			const input = {
				refs: [
					{
						id: asset.id,
					},
				],
			};
			await run(p.asset.delete(input, injected));
			expect(cleanupAttempts).toBeGreaterThan(0);
			const rows = await run(
				Effect.gen(function* () {
					return yield* (yield* DB)
						.select()
						.from(dbSchema.asset)
						.where(eq(dbSchema.asset.id, asset.id));
				}),
			);
			expect(rows).toHaveLength(0);
			expect(await stored(objects)).toEqual(objects.map(({ key }) => key));
			await run(cleanupComesDue(asset.id));
			await run(cleanUpDueDeletions);
			expect(await stored(objects)).toEqual([]);
		} finally {
			for (const object of objects) await run(sendDeleteObjectCommand(object));
		}
	},
	TIMEOUT,
);
