import { describe, expect, test } from "bun:test";
import { PgClient } from "@effect/sql-pg";
import type { ActivityRunId, AssetId, OrganizationId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { PgBossService } from "@orcai/pg-boss";
import { cleanUpDueDeletions } from "@orcai/preparation";
import {
	assetObjectKey,
	UPLOAD_ROUTES,
	UPLOAD_STAGING_PREFIX,
} from "@orcai/s3";
import {
	isS3NotFound,
	S3Service,
	sendHeadObjectCommand,
} from "@orcai/s3/server";
import {
	type AssetIntakeResult,
	type AssetUploadRoute,
	PROCESS_ASSET_JOB_NAME,
	type UploadFileObject,
} from "@orcai/schema";
import { NEWEST_REVISION } from "@orcai/spice-db";
import { eq, inArray, sql } from "drizzle-orm";
import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import { createAssetsFromUploads } from "@/lib/assets/intake";
import { deleteResourcesWithAuthorization } from "@/lib/authz/resource-lifecycle";
import { AuthzService } from "@/lib/effect/services/authz";
import { Procedures } from "@/lib/orpc/implementation/procedures";
import {
	type Actor,
	appIntegration,
	TIMEOUT,
} from "@/lib/testing/app-integration";

const { run, organizationWith, procedureOptions, outboxDelivered, readTuples } =
	appIntegration();

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

/** Signs one text upload as `actor`; `put` sends its bytes like the browser, as often as called. */
const signUpload = async (
	{ actor, zedToken }: Member,
	name: string,
	route: AssetUploadRoute = "asset",
) => {
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
	const put = async () => {
		const response = await fetch(target.signedUrl, {
			method: "PUT",
			headers: target.headers,
			body: CONTENT,
		});
		expect(response.ok).toBe(true);
	};
	return {
		file: target.file,
		put,
	};
};

/** Signs one text upload as `actor` and, unless `put` is false, puts its bytes like the browser. */
const upload = async (
	member: Member,
	name: string,
	route: AssetUploadRoute = "asset",
	put = true,
): Promise<UploadFileObject> => {
	const signed = await signUpload(member, name, route);
	if (put) await signed.put();
	return signed.file;
};

const createFromUploads = async (
	{ actor, zedToken }: Member,
	files: UploadFileObject[],
	route: AssetUploadRoute = "asset",
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

/** The seqs of the outbox events `eventIds`. */
const outboxSeqs = (eventIds: readonly string[]) =>
	run(
		Effect.gen(function* () {
			const db = yield* DB;
			const rows = yield* db
				.select({
					seq: dbSchema.authzOutbox.seq,
				})
				.from(dbSchema.authzOutbox)
				.where(
					inArray(dbSchema.authzOutbox.id, [
						...eventIds,
					]),
				);
			return rows.map((row) => row.seq);
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
				keptIn: "chat",
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
		"a staged file stored under another type than signed fails alone",
		async () => {
			const [owner] = await members(1);
			const procedures = await run(Procedures);
			const signed = await run(
				procedures.storage.createUploadUrls(
					{
						route: "asset",
						files: [
							{
								name: "notes.txt",
								size: CONTENT.length,
								type: "text/plain",
							},
						],
					},
					await procedureOptions(owner.actor, owner.zedToken),
				),
			);
			const [target] = signed.data;
			if (target?.mode !== "single")
				throw new Error("Expected a single upload");
			// The store may keep a PUT whose type differs from the signed one.
			const response = await fetch(target.signedUrl, {
				method: "PUT",
				headers: {
					"Content-Type": "text/html",
				},
				body: CONTENT,
			});

			const [result] = await createFromUploads(owner, [
				target.file,
			]);
			expect(result).toMatchObject({
				status: "failed",
				reason: response.ok
					? "UPLOAD_FILE_TYPE_INVALID"
					: "UPLOAD_FILE_MISSING",
			});
			expect(await assetRows(target.file.objectKey)).toEqual([]);
		},
		TIMEOUT,
	);

	test(
		"a multipart upload becomes an asset with its signed type",
		async () => {
			const [owner] = await members(1);
			const procedures = await run(Procedures);
			const options = await procedureOptions(owner.actor, owner.zedToken);
			const body = new Uint8Array(
				UPLOAD_ROUTES.asset.multipart.thresholdSize + 1,
			).fill(97);
			const signed = await run(
				procedures.storage.createUploadUrls(
					{
						route: "asset",
						files: [
							{
								name: "large.txt",
								size: body.byteLength,
								type: "text/plain",
							},
						],
					},
					options,
				),
			);
			const [target] = signed.data;
			if (target?.mode !== "multipart")
				throw new Error("Expected a multipart upload");
			const parts = await Promise.all(
				target.parts.map(async (part) => {
					const start = (part.partNumber - 1) * target.partSize;
					const response = await fetch(part.signedUrl, {
						method: "PUT",
						body: body.subarray(start, start + part.size),
					});
					expect(response.ok).toBe(true);
					return {
						partNumber: part.partNumber,
						etag: response.headers.get("ETag") ?? "",
					};
				}),
			);
			await run(
				procedures.storage.completeMultipartUpload(
					{
						route: "asset",
						uploadId: target.uploadId,
						parts,
						file: target.file,
					},
					options,
				),
			);

			const asset = created(
				(
					await createFromUploads(owner, [
						target.file,
					])
				)[0],
			);
			expect(asset).toMatchObject({
				fileType: "txt",
				size: body.byteLength,
			});
		},
		TIMEOUT,
	);

	test(
		"a library upload is one activity run that a repeat with its key joins; a chat upload is none",
		async () => {
			const [owner] = await members(1);
			const procedures = await run(Procedures);
			const options = await procedureOptions(owner.actor, owner.zedToken);
			const uploadKey = crypto.randomUUID();
			const first = await upload(owner, "first.txt");
			const second = await upload(owner, "second.txt");
			const call = (files: UploadFileObject[]) =>
				run(
					procedures.asset.createFromUploads(
						{
							route: "asset",
							files,
							uploadKey,
						},
						options,
					),
				);

			const opened = await call([
				first,
			]);
			const joined = await call([
				first,
				second,
			]);
			expect(opened.runId).not.toBeNull();
			expect(joined.runId).toBe(opened.runId);
			const [asset] = joined.data.map(created);
			expect((await processJobsFor(asset.id)).map((job) => job.data)).toEqual([
				expect.objectContaining({
					runId: opened.runId,
				}),
			]);
			const listed = await run(
				procedures.asset.list(
					{
						pageIndex: 0,
						pageSize: 10,
						filters: {
							runId: opened.runId ?? undefined,
						},
					},
					await procedureOptions(owner.actor, joined.meta?.zedToken),
				),
			);
			expect(listed.rowCount).toBe(2);

			const chat = await run(
				procedures.asset.createFromUploads(
					{
						route: "chatAttachment",
						files: [
							await upload(owner, "chat.txt", "chatAttachment"),
						],
					},
					options,
				),
			);
			expect(chat.runId).toBeNull();
		},
		TIMEOUT,
	);

	test(
		"a call stopped once its asset commits leaves the processing queued, so a retry needs nothing more",
		async () => {
			const [owner] = await members(1);
			const procedures = await run(Procedures);
			const options = await procedureOptions(owner.actor, owner.zedToken);
			const file = await upload(owner, "stopped.txt");
			const call = procedures.asset.createFromUploads(
				{
					route: "asset",
					files: [
						file,
					],
					uploadKey: crypto.randomUUID(),
				},
				options,
			);

			// One statement, one snapshot: the asset and its job as committed together.
			const committed = () =>
				run(
					Effect.gen(function* () {
						const sql = yield* PgClient.PgClient;
						const { schema } = yield* PgBossService;
						const [row] = yield* sql<{
							asset: boolean;
							job: boolean;
						}>`SELECT
						exists (SELECT 1 FROM asset WHERE id = ${file.objectKey}) AS asset,
						exists (SELECT 1 FROM ${sql(schema)}.job WHERE name = ${PROCESS_ASSET_JOB_NAME}
							AND data -> 'assetRef' ->> 'id' = ${file.objectKey}) AS job`;
						return row;
					}),
				);
			const fiber = await run(Effect.forkDetach(call));
			let seen = await committed();
			while (!seen?.asset) seen = await committed();
			await run(Fiber.interrupt(fiber));

			expect(seen).toEqual({
				asset: true,
				job: true,
			});
			const asset = created(
				(
					await createFromUploads(owner, [
						file,
					])
				)[0],
			);
			expect(asset.processingStatus).toBe("pending");
			expect(await processJobsFor(asset.id)).toHaveLength(1);
		},
		TIMEOUT,
	);

	test(
		"a queue that refuses the job leaves the upload failed, for Retry",
		async () => {
			const [owner] = await members(1);
			const file = await upload(owner, "refused.txt");
			const refusing = {
				insert: () => Promise.reject(new Error("Queue does not exist")),
			};

			const { results, runId } = await run(
				createAssetsFromUploads({
					route: "asset",
					userId: owner.actor.user.id,
					organizationId: owner.actor.session
						.activeOrganizationId as OrganizationId,
					files: [
						file,
					],
					uploadKey: crypto.randomUUID(),
				}).pipe(
					Effect.provideService(PgBossService, {
						boss: refusing as never,
						schema: "pgboss",
					}),
				),
			);

			const asset = created(results[0]);
			expect(asset.processingStatus).toBe("failed");
			const [row] = await assetRows(asset.id);
			expect(row?.processingFailureId).toEqual(expect.any(String));
			const [member] = await run(
				Effect.gen(function* () {
					return yield* (yield* DB)
						.select({
							state: dbSchema.activityMember.processingState,
							failureId: dbSchema.activityMember.processingFailureId,
						})
						.from(dbSchema.activityMember)
						.where(eq(dbSchema.activityMember.runId, runId as ActivityRunId));
				}),
			);
			expect(member).toEqual({
				state: "failed",
				failureId: row?.processingFailureId,
			});
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
			expect(first.keptIn).toBe("library");
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
		keptIn: "library" | "chat",
	) => {
		const procedures = await run(Procedures);
		const { data } = await run(
			procedures.asset.list(
				{
					pageIndex: 0,
					pageSize: 100,
					filters: {
						keptIn,
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
			expect(data.keptIn).toBe("library");
			expect(await listIds(withToken, "library")).toContain(asset.id);
			expect(await listIds(withToken, "chat")).not.toContain(asset.id);
		},
		TIMEOUT,
	);

	test(
		"publish the token of their newest grant when an older delivery finishes last",
		async () => {
			const [owner] = await members(1);
			const files = await Promise.all([
				upload(owner, "first.txt", "chatAttachment"),
				upload(owner, "second.txt", "chatAttachment"),
			]);
			const procedures = await run(Procedures);
			const authz = await run(AuthzService);
			const arrived = await run(Deferred.make<void>());
			const newerDelivered = await run(Deferred.make<void>());
			const seqs: number[] = [];
			let newerToken: string | undefined;

			// Both deliveries wait for each other; the newer event's runs first.
			const newestFirst: typeof authz = {
				...authz,
				deliverRelationshipEvents: (eventIds) =>
					Effect.gen(function* () {
						const seq = Math.max(
							...(yield* Effect.promise(() => outboxSeqs(eventIds))),
						);
						seqs.push(seq);
						if (seqs.length === 2) yield* Deferred.succeed(arrived, undefined);
						yield* Deferred.await(arrived);
						if (seq < Math.max(...seqs)) {
							yield* Deferred.await(newerDelivered);
							return yield* authz.deliverRelationshipEvents(eventIds);
						}
						const delivery = yield* authz.deliverRelationshipEvents(eventIds);
						newerToken = delivery.zedToken;
						yield* Deferred.succeed(newerDelivered, undefined);
						return delivery;
					}),
			};

			const options = await procedureOptions(owner.actor, owner.zedToken);
			const { data, meta } = await run(
				procedures.asset.createFromUploads(
					{
						route: "chatAttachment",
						files,
					},
					{
						...options,
						context: {
							...options.context,
							"effect/context": Context.add(
								options.context["effect/context"],
								AuthzService,
								newestFirst,
							),
						},
					},
				),
			);

			expect(data.map((result) => created(result).fileName)).toEqual([
				"first.txt",
				"second.txt",
			]);
			expect(newerToken).toBeString();
			expect(meta?.zedToken).toBe(newerToken);
		},
		TIMEOUT,
	);
});

/** S3 whose requests go through `gate` first. */
const gatedStorage = async (gate: (command: object) => Promise<void>) => {
	const s3 = await run(S3Service);
	return {
		...s3,
		client: new Proxy(s3.client, {
			get(target, key) {
				if (key === "send")
					return async (command: object, ...rest: unknown[]) => {
						await gate(command);
						return Reflect.apply(target.send, target, [
							command,
							...rest,
						]);
					};
				return Reflect.get(target, key);
			},
		}),
	};
};

/** Deletes the asset while storage is down, so its cleanup stays pending. */
const deleteWhileStorageDown = async (owner: Member, assetId: AssetId) =>
	run(
		deleteResourcesWithAuthorization({
			resourceType: "asset",
			resourceIds: [
				assetId,
			],
			actor: {
				userId: owner.actor.user.id,
				zedToken: NEWEST_REVISION,
			},
		}).pipe(
			Effect.provideService(
				S3Service,
				await gatedStorage(() =>
					Promise.reject(new Error("injected storage outage")),
				),
			),
		),
	);

/** Retries the asset's pending cleanup now, as the worker does once it is due. */
const retryCleanup = (assetId: AssetId) =>
	run(
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
			yield* cleanUpDueDeletions;
		}),
	);

describe("deleted assets", () => {
	test(
		"an upload cannot bring back a deleted asset whose files are still being removed",
		async () => {
			const [owner] = await members(1);
			const { file, put } = await signUpload(owner, "deleted.txt");
			await put();
			const asset = created(
				(
					await createFromUploads(owner, [
						file,
					])
				)[0],
			);
			await deleteWhileStorageDown(owner, asset.id);

			// The signed URL still works, so the same upload can be taken in again.
			await put();
			const [again] = await createFromUploads(owner, [
				file,
			]);
			expect(again).toMatchObject({
				status: "failed",
				reason: "UPLOAD_CREATE_FAILED",
			});
			expect(await assetRows(asset.id)).toEqual([]);

			await retryCleanup(asset.id);
			expect(await objectExists(asset.bucket, assetObjectKey(asset))).toBe(
				false,
			);
		},
		TIMEOUT,
	);

	test(
		"an intake that checked before the asset was created and deleted does not bring it back",
		async () => {
			const [owner] = await members(1);
			const { file, put } = await signUpload(owner, "raced.txt");
			await put();
			const copying = Promise.withResolvers<void>();
			const resume = Promise.withResolvers<void>();
			const paused = await gatedStorage(async (command) => {
				if (
					"CopySource" in
					(
						command as {
							input: object;
						}
					).input
				) {
					copying.resolve();
					await resume.promise;
				}
			});
			const options = await procedureOptions(owner.actor, owner.zedToken);
			const procedures = await run(Procedures);
			const late = run(
				procedures.asset.createFromUploads(
					{
						route: "asset",
						files: [
							file,
						],
					},
					{
						...options,
						context: {
							...options.context,
							"effect/context": Context.add(
								options.context["effect/context"],
								S3Service,
								paused,
							),
						},
					},
				),
			);
			await copying.promise;

			const asset = created(
				(
					await createFromUploads(owner, [
						file,
					])
				)[0],
			);
			await deleteWhileStorageDown(owner, asset.id);
			await put();
			resume.resolve();

			const [result] = (await late).data;
			expect(result).toMatchObject({
				status: "failed",
				reason: "UPLOAD_CREATE_FAILED",
			});
			expect(await assetRows(asset.id)).toEqual([]);
			await retryCleanup(asset.id);
			expect(await objectExists(asset.bucket, assetObjectKey(asset))).toBe(
				false,
			);
		},
		TIMEOUT,
	);
});
