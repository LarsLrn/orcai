import type { AssetId, OrganizationId, UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { logErrorCause } from "@orcai/observability";
import {
	getFileTypeFromMime,
	isMimeAllowed,
	UPLOAD_ROUTES,
	type UploadRouteName,
} from "@orcai/s3";
import {
	isS3NotFound,
	sendCopyObjectCommand,
	sendDeleteObjectCommand,
	sendHeadObjectCommand,
	validateUploadEnvelope,
} from "@orcai/s3/server";
import {
	type Asset,
	type AssetIntakeResult,
	type AssetOrigin,
	assetFileTypeSchema,
	assetIdSchema,
	type ErrorReasonProps,
	type UploadFileObject,
} from "@orcai/schema";
import { eq } from "drizzle-orm";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import { enqueueAssetProcessing } from "@/lib/assets/processing";
import { writeRelationships } from "@/lib/authz/relationship-write";
import { initializeResourceAuthorization } from "@/lib/authz/resource-lifecycle";

const ORIGIN_BY_ROUTE = {
	asset: "library",
	chatAttachment: "chat",
} as const satisfies Record<UploadRouteName, AssetOrigin>;

/** A file the intake refuses, with the reason the client translates. */
class UploadRejected extends Data.TaggedError("UploadRejected")<{
	readonly rejection: ErrorReasonProps;
}> {}

const reject = (rejection: ErrorReasonProps) =>
	Effect.fail(
		new UploadRejected({
			rejection,
		}),
	);

type Intake = {
	route: UploadRouteName;
	userId: UserId;
	organizationId: OrganizationId;
};

/** Validates the file against the caller and the route and derives every coordinate. */
const planUpload = (intake: Intake, file: UploadFileObject) =>
	Effect.gen(function* () {
		const coordinates = yield* validateUploadEnvelope({
			file,
			route: intake.route,
			userId: intake.userId,
		}).pipe(
			Effect.catchTag("S3Error", () =>
				reject({
					reason: "UPLOAD_REQUEST_INVALID",
				}),
			),
		);

		const fileType = assetFileTypeSchema.safeParse(
			getFileTypeFromMime(file.type),
		);
		const route = UPLOAD_ROUTES[intake.route];
		if (
			!fileType.success ||
			!isMimeAllowed({
				mimeType: file.type,
				allowedMimePatterns: route.allowedMimePatterns,
			})
		) {
			return yield* reject({
				reason: "UPLOAD_FILE_TYPE_INVALID",
				params: {
					fileName: file.name,
					fileType: file.type,
				},
			});
		}

		if (file.size > route.maxFileSize) {
			return yield* reject({
				reason: "UPLOAD_FILE_TOO_LARGE",
				params: {
					fileName: file.name,
				},
			});
		}

		return {
			...coordinates,
			id: assetIdSchema.parse(coordinates.id),
			fileType: fileType.data,
		};
	});

/** The existing asset for a repeated upload: the owner gets it back, anyone else is refused. */
const existingAsset = (intake: Intake, asset: Asset) =>
	asset.userId === intake.userId
		? Effect.succeed(asset)
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

const createAssetFromUpload = (intake: Intake, file: UploadFileObject) =>
	Effect.gen(function* () {
		const plan = yield* planUpload(intake, file);

		const existing = yield* findAsset(plan.id);
		if (existing) {
			return yield* existingAsset(intake, existing);
		}

		const staged = yield* sendHeadObjectCommand({
			bucket: plan.bucket,
			key: plan.stagingKey,
		}).pipe(
			Effect.catchIf(isS3NotFound, () =>
				reject({
					reason: "UPLOAD_FILE_MISSING",
				}),
			),
		);
		if (staged.ContentLength !== file.size) {
			return yield* reject({
				reason: "UPLOAD_FILE_SIZE_MISMATCH",
			});
		}

		yield* sendCopyObjectCommand({
			bucket: plan.bucket,
			sourceKey: plan.stagingKey,
			key: plan.key,
		});

		const { result: inserted } = yield* writeRelationships(
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
						id: plan.id,
						title: file.name,
						size: file.size,
						fileType: plan.fileType,
						origin: ORIGIN_BY_ROUTE[intake.route],
						bucket: plan.bucket,
						prefix: plan.prefix,
						userId: intake.userId,
					})
					.onConflictDoNothing({
						target: dbSchema.asset.id,
					})
					.returning();

				if (asset) {
					yield* initializeResourceAuthorization({
						resource: {
							resourceType: "asset",
							resourceId: asset.id,
						},
						organizationId: intake.organizationId,
						ownerUserId: intake.userId,
					});
				}

				return asset;
			}),
		);

		// A concurrent call for the same upload inserted first.
		if (!inserted) {
			const winner = yield* findAsset(plan.id);
			return winner
				? yield* existingAsset(intake, winner)
				: yield* reject({
						reason: "UPLOAD_CREATE_FAILED",
					});
		}

		// The lifecycle rule expires a staged copy left behind.
		yield* sendDeleteObjectCommand({
			bucket: plan.bucket,
			key: plan.stagingKey,
		}).pipe(
			Effect.catchCause((cause) =>
				logErrorCause("Staged upload not deleted", cause),
			),
		);

		yield* enqueueAssetProcessing(inserted).pipe(
			Effect.catchCause((cause) =>
				logErrorCause("Asset processing not enqueued", cause),
			),
		);

		return inserted;
	});

const intakeResult = (intake: Intake, file: UploadFileObject) =>
	createAssetFromUpload(intake, file).pipe(
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
 * the asset's key, inserts the row with its owner and organization, and
 * enqueues processing. Bucket, keys and origin come from the caller and the
 * route, never from the client.
 *
 * One result per file in input order; a failing file does not block the
 * others. Repeating an upload returns its asset to the owner and fails for
 * anyone else.
 */
export const createAssetsFromUploads = (
	intake: Intake & {
		files: readonly UploadFileObject[];
	},
) =>
	Effect.forEach(intake.files, (file) => intakeResult(intake, file), {
		concurrency: 10,
	});
