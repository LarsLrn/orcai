import { describe, expect, test } from "bun:test";
import { DB, dbSchema } from "@orcai/db";
import { PgBossService } from "@orcai/pg-boss";
import { UPLOAD_STAGING_PREFIX } from "@orcai/s3";
import { isS3NotFound, sendHeadObjectCommand } from "@orcai/s3/server";
import {
	type AssetIntakeResult,
	PROCESS_ASSET_JOB_NAME,
	type StorageUploadRoute,
	type UploadFileObject,
} from "@orcai/schema";
import { eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import {
	type Actor,
	authzIntegration,
	TIMEOUT,
} from "@/lib/authz/authz-integration";
import { Procedures } from "@/lib/orpc/implementation/procedures";

const { run, organizationWith, procedureOptions, outboxDelivered, readTuples } =
	authzIntegration();

type Member = {
	actor: Actor;
	zedToken: string | undefined;
};

/** Members of one fresh organization, each with the zedToken that made them members. */
const members = async (count: number): Promise<Member[]> => {
	const { actors, zedToken } = await organizationWith(
		Array.from(
			{
				length: count,
			},
			() => "member" as const,
		),
	);
	return actors.map((actor) => ({
		actor,
		zedToken,
	}));
};

const CONTENT = "Uploaded by the asset intake integration test.";

/** Signs one text upload as `actor` and, unless `put` is false, puts its bytes like the browser. */
const upload = async (
	{ actor, zedToken }: Member,
	name: string,
	route: StorageUploadRoute = "asset",
	put = true,
): Promise<UploadFileObject> => {
	const procedures = await run(Procedures);
	const signed = await run(
		procedures.storage.createUploadUrls(
			{
				route,
				files: [
					{
						name,
						size: CONTENT.length,
						type: "text/plain",
					},
				],
			},
			await procedureOptions(actor, zedToken),
		),
	);
	const [target] = signed.data;
	if (target?.mode !== "single") throw new Error("Expected a single upload");
	if (!put) return target.file;

	const response = await fetch(target.signedUrl, {
		method: "PUT",
		headers: target.headers,
		body: CONTENT,
	});
	expect(response.ok).toBe(true);

	return target.file;
};

const createFromUploads = async (
	{ actor, zedToken }: Member,
	files: UploadFileObject[],
	route: StorageUploadRoute = "asset",
): Promise<AssetIntakeResult[]> => {
	const procedures = await run(Procedures);
	const { data } = await run(
		procedures.asset.createFromUploads(
			{
				route,
				files,
			},
			await procedureOptions(actor, zedToken),
		),
	);
	return data;
};

const created = (result: AssetIntakeResult | undefined) => {
	if (result?.status !== "created") {
		throw new Error(`Expected a created asset, got ${JSON.stringify(result)}`);
	}
	return result.asset;
};

const objectExists = (bucket: string, key: string) =>
	run(
		sendHeadObjectCommand({
			bucket,
			key,
		}).pipe(
			Effect.as(true),
			Effect.catchIf(isS3NotFound, () => Effect.succeed(false)),
		),
	);

const assetRows = (id: string) =>
	run(
		Effect.gen(function* () {
			const db = yield* DB;
			return yield* db
				.select()
				.from(dbSchema.asset)
				.where(eq(dbSchema.asset.id, id as never));
		}),
	);

// Workers create their queues at boot; the tier runs none.
const ensureProcessQueue = () =>
	run(
		Effect.gen(function* () {
			const { boss } = yield* PgBossService;
			yield* Effect.promise(() => boss.createQueue(PROCESS_ASSET_JOB_NAME));
		}),
	);

const processJobsFor = (assetId: string) =>
	run(
		Effect.gen(function* () {
			const { boss } = yield* PgBossService;
			return yield* Effect.promise(() =>
				boss.findJobs(PROCESS_ASSET_JOB_NAME, {
					data: {
						assetRef: {
							id: assetId,
						},
					},
				}),
			);
		}),
	);

describe("createAssetsFromUploads", () => {
	test(
		"another user cannot create an asset over someone else's upload",
		async () => {
			const [owner, other] = await members(2);
			const file = await upload(owner, "owner.txt");
			const foreignPrefix = file.objectMetadata.prefix.replace(
				owner.actor.user.id,
				other.actor.user.id,
			);

			const forgeries: UploadFileObject[] = [
				file,
				{
					...file,
					objectMetadata: {
						...file.objectMetadata,
						userId: other.actor.user.id,
					},
				},
				{
					...file,
					objectMetadata: {
						...file.objectMetadata,
						userId: other.actor.user.id,
						prefix: foreignPrefix,
						key: file.objectMetadata.key.replace(
							owner.actor.user.id,
							other.actor.user.id,
						),
					},
				},
			];
			const results = await createFromUploads(other, forgeries);

			expect(results.map((result) => result.status)).toEqual([
				"failed",
				"failed",
				"failed",
			]);
			expect(
				results.map((result) =>
					result.status === "failed" ? result.reason : undefined,
				),
			).toEqual([
				"UPLOAD_REQUEST_INVALID",
				"UPLOAD_REQUEST_INVALID",
				"UPLOAD_FILE_MISSING",
			]);
			expect(await assetRows(file.objectKey)).toEqual([]);

			const asset = created(
				(
					await createFromUploads(owner, [
						file,
					])
				)[0],
			);
			const [claimed] = await createFromUploads(other, [
				forgeries[2] as UploadFileObject,
			]);
			expect(claimed).toMatchObject({
				status: "failed",
				reason: "PERMISSION_DENIED",
			});
			expect((await assetRows(asset.id))[0]?.userId).toBe(owner.actor.user.id);
		},
		TIMEOUT,
	);

	test(
		"moves the staged file, records the owner and enqueues processing",
		async () => {
			await ensureProcessQueue();
			const [owner] = await members(1);
			const file = await upload(owner, "notes.txt", "chatAttachment");

			const asset = created(
				(
					await createFromUploads(
						owner,
						[
							file,
						],
						"chatAttachment",
					)
				)[0],
			);

			expect(asset).toMatchObject({
				id: file.objectKey,
				title: "notes.txt",
				fileType: "txt",
				origin: "chat",
				processingStatus: "pending",
				userId: owner.actor.user.id,
				prefix: file.objectMetadata.prefix.slice(UPLOAD_STAGING_PREFIX.length),
			});
			expect(
				await objectExists(asset.bucket, `${asset.prefix}/${asset.id}.txt`),
			).toBe(true);
			expect(
				await objectExists(asset.bucket, file.objectMetadata.key as string),
			).toBe(false);

			await outboxDelivered(asset.id);
			expect(
				await readTuples({
					resourceType: "asset",
					resourceId: asset.id,
					subjectId: owner.actor.user.id,
				}),
			).toContain(`owner@user:${owner.actor.user.id}`);
			expect(await processJobsFor(asset.id)).toHaveLength(1);
		},
		TIMEOUT,
	);

	test(
		"a repeat by the owner returns the same asset",
		async () => {
			const [owner] = await members(1);
			const file = await upload(owner, "repeat.txt");

			const first = created(
				(
					await createFromUploads(owner, [
						file,
					])
				)[0],
			);
			const again = created(
				(
					await createFromUploads(owner, [
						file,
					])
				)[0],
			);

			expect(again.id).toBe(first.id);
			expect(await assetRows(first.id)).toHaveLength(1);
			expect(first.origin).toBe("library");
		},
		TIMEOUT,
	);

	test(
		"a missing file fails alone",
		async () => {
			const [owner] = await members(1);
			const resized = await upload(owner, "resized.txt");
			const present = await upload(owner, "present.txt");
			const missing = await upload(owner, "missing.txt", "asset", false);

			const results = await createFromUploads(owner, [
				{
					...resized,
					size: CONTENT.length + 1,
				},
				present,
				missing,
			]);

			expect(results).toMatchObject([
				{
					status: "failed",
					objectKey: resized.objectKey,
					reason: "UPLOAD_FILE_SIZE_MISMATCH",
				},
				{
					status: "created",
					objectKey: present.objectKey,
				},
				{
					status: "failed",
					objectKey: missing.objectKey,
					reason: "UPLOAD_FILE_MISSING",
				},
			]);
			expect(await assetRows(missing.objectKey)).toEqual([]);
		},
		TIMEOUT,
	);
});

describe("chat uploads", () => {
	const listIds = async (
		{ actor, zedToken }: Member,
		origin: "library" | "chat",
	) => {
		const procedures = await run(Procedures);
		const { data } = await run(
			procedures.asset.list(
				{
					pageIndex: 0,
					pageSize: 100,
					filters: {
						origin,
					},
				},
				await procedureOptions(actor, zedToken),
			),
		);
		return data.map((asset) => asset.id);
	};

	test(
		"stay out of the library until the owner adds them",
		async () => {
			const [owner, other] = await members(2);
			const file = await upload(owner, "chat.txt", "chatAttachment");
			const procedures = await run(Procedures);
			const createdUpload = await run(
				procedures.asset.createFromUploads(
					{
						route: "chatAttachment",
						files: [
							file,
						],
					},
					await procedureOptions(owner.actor, owner.zedToken),
				),
			);
			const asset = created(createdUpload.data[0]);
			const withToken = {
				...owner,
				zedToken: createdUpload.meta?.zedToken ?? owner.zedToken,
			};

			expect(await listIds(withToken, "chat")).toContain(asset.id);
			expect(await listIds(withToken, "library")).not.toContain(asset.id);

			const refused = await run(
				procedures.asset
					.addToLibrary(
						{
							id: asset.id,
						},
						await procedureOptions(other.actor, other.zedToken),
					)
					.pipe(Effect.flip),
			);
			expect(refused).toMatchObject({
				_tag: "ForbiddenError",
				reason: "PERMISSION_DENIED",
			});

			const { data } = await run(
				procedures.asset.addToLibrary(
					{
						id: asset.id,
					},
					await procedureOptions(owner.actor, withToken.zedToken),
				),
			);
			expect(data.origin).toBe("library");
			expect(await listIds(withToken, "library")).toContain(asset.id);
			expect(await listIds(withToken, "chat")).not.toContain(asset.id);
		},
		TIMEOUT,
	);
});
