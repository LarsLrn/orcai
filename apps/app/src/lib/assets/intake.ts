import type {
	ActivityRunId,
	AssetId,
	OrganizationId,
	UserId,
} from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { logErrorCause } from "@orcai/observability";
import {
	addActivityMember,
	admit,
	cleanUpDeletions,
	openUploadRun,
	recordDeletion,
	releaseAdmission,
	renewAdmission,
	wasAssetDeleted,
} from "@orcai/preparation";
import {
	checkUpload,
	claimStagedUpload,
	UploadRejected,
} from "@orcai/s3/server";
import {
	type Asset,
	type AssetIntakeResult,
	type AssetKeptIn,
	type AssetUploadRoute,
	assetIdSchema,
	type ErrorReasonProps,
	type UploadFileObject,
} from "@orcai/schema";
import { eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { writeRelationships } from "@/lib/authz/relationship-write";
import { initializeResourceAuthorization } from "@/lib/authz/resource-lifecycle";

const KEPT_IN_BY_ROUTE = {
	asset: "library",
	chatAttachment: "chat",
} as const satisfies Record<AssetUploadRoute, AssetKeptIn>;

const reject = (rejection: ErrorReasonProps) =>
	Effect.fail(
		new UploadRejected({
			rejection,
		}),
	);

type Intake = {
	route: AssetUploadRoute;
	userId: UserId;
	organizationId: OrganizationId;
};

/** The upload run a call adds its files to, and the call's lease on it. */
type Admission = {
	runId: ActivityRunId;
	leaseId: string;
};

/**
 * The existing asset for a repeated upload: the owner gets it back, also as
 * part of the call's run, and anyone else is refused.
 */
const existingAsset = (
	intake: Intake,
	asset: Asset,
	admission: Admission | undefined,
) =>
	asset.userId === intake.userId
		? Effect.as(
				admission ? addActivityMember(admission.runId, asset.id) : Effect.void,
				asset,
			)
		: reject({
				reason: "PERMISSION_DENIED",
			});

const findAsset = (id: AssetId) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const [asset] = yield* db
			.select()
			.from(dbSchema.asset)
			.where(eq(dbSchema.asset.id, id));
		return asset;
	});

const createAssetFromUpload = (
	intake: Intake,
	admission: Admission | undefined,
	file: UploadFileObject,
) =>
	Effect.gen(function* () {
		const upload = yield* checkUpload({
			file,
			route: intake.route,
			userId: intake.userId,
		});
		const id = assetIdSchema.parse(upload.id);

		const existing = yield* findAsset(id);
		if (existing) {
			return yield* existingAsset(intake, existing, admission);
		}
		// Its cleanup may still be removing files under this id; the insert checks again.
		if (yield* wasAssetDeleted(id))
			return yield* reject({
				reason: "UPLOAD_CREATE_FAILED",
			});

		const insert = writeRelationships(
			{
				organizationIds: [
					intake.organizationId,
				],
			},
			Effect.gen(function* () {
				const db = yield* DB;
				const [asset] = yield* db
					.insert(dbSchema.asset)
					.values({
						id,
						title: file.name,
						fileName: file.name,
						size: file.size,
						fileType: upload.fileType,
						keptIn: KEPT_IN_BY_ROUTE[intake.route],
						bucket: upload.bucket,
						prefix: upload.prefix,
						userId: intake.userId,
					})
					.onConflictDoNothing({
						target: dbSchema.asset.id,
					})
					.returning();

				if (!asset) return undefined;
				// Waited for a deletion of the id in flight, so a recheck sees its record.
				if (yield* wasAssetDeleted(id)) {
					yield* db.delete(dbSchema.asset).where(eq(dbSchema.asset.id, id));
					return {
						refused: yield* recordDeletion({
							files: [
								{
									id,
									bucket: upload.bucket,
									prefix: upload.prefix,
									fileType: upload.fileType,
								},
							],
							indexedLinks: [],
						}),
					};
				}
				yield* initializeResourceAuthorization({
					resource: {
						resourceType: "asset",
						resourceId: asset.id,
					},
					organizationId: intake.organizationId,
					ownerUserId: intake.userId,
				});
				// A new asset waits pending at generation 0 for its first processing.
				yield* admit({
					stage: "processing",
					assets: [
						{
							id: asset.id,
							generation: asset.processingGeneration,
						},
					],
					from: [
						"pending",
					],
					failWhenRefused: true,
					run: admission
						? {
								id: admission.runId,
							}
						: undefined,
				});
				return {
					asset: (yield* findAsset(asset.id)) ?? asset,
				};
			}),
		);
		const { result: inserted } = yield* claimStagedUpload(upload, {
			key: upload.key,
			commit: insert,
		});

		if (inserted && "refused" in inserted) {
			yield* cleanUpDeletions([
				inserted.refused,
			]);
			return yield* reject({
				reason: "UPLOAD_CREATE_FAILED",
			});
		}

		// A concurrent call for the same upload inserted first.
		if (!inserted) {
			const winner = yield* findAsset(id);
			return winner
				? yield* existingAsset(intake, winner, admission)
				: yield* reject({
						reason: "UPLOAD_CREATE_FAILED",
					});
		}

		return inserted.asset;
	});

const intakeResult = (
	intake: Intake,
	admission: Admission | undefined,
	file: UploadFileObject,
) =>
	createAssetFromUpload(intake, admission, file).pipe(
		Effect.tap(() =>
			admission ? renewAdmission(admission.leaseId) : Effect.void,
		),
		Effect.map(
			(asset): AssetIntakeResult => ({
				status: "created",
				objectKey: file.objectKey,
				asset,
			}),
		),
		Effect.catchTag("UploadRejected", ({ rejection }) =>
			Effect.succeed<AssetIntakeResult>({
				status: "failed",
				objectKey: file.objectKey,
				...rejection,
			}),
		),
		Effect.catchCause((cause) =>
			logErrorCause("Asset intake failed", cause).pipe(
				Effect.as<AssetIntakeResult>({
					status: "failed",
					objectKey: file.objectKey,
					reason: "UPLOAD_CREATE_FAILED",
				}),
			),
		),
	);

/**
 * Creates one asset per uploaded file: checks the staged object, moves it to
 * the asset's key, and inserts the row with its owner and organization and
 * its processing job in one transaction, so an asset never lacks its job. Bucket, keys and where it is kept come from the caller and the
 * route, never from the client. A library upload is an activity run; calls
 * with the same `uploadKey` add to one run.
 *
 * One result per file in input order; a failing file does not block the
 * others. Repeating an upload returns its asset to the owner and fails for
 * anyone else.
 */
export const createAssetsFromUploads = (
	intake: Intake & {
		files: readonly UploadFileObject[];
		uploadKey?: string;
	},
) =>
	Effect.gen(function* () {
		const admission =
			intake.route === "asset"
				? yield* openUploadRun({
						userId: intake.userId,
						organizationId: intake.organizationId,
						clientKey: intake.uploadKey,
					})
				: undefined;
		const results = yield* Effect.forEach(
			intake.files,
			(file) => intakeResult(intake, admission, file),
			{
				concurrency: 10,
			},
		).pipe(
			Effect.ensuring(
				admission
					? releaseAdmission(admission.leaseId).pipe(
							Effect.catchCause((cause) =>
								logErrorCause("Upload admission not released", cause),
							),
						)
					: Effect.void,
			),
		);
		return {
			results,
			runId: admission?.runId ?? null,
		};
	});
