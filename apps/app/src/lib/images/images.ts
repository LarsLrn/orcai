import type { UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { logErrorCause } from "@orcai/observability";
import {
	type ImageOwner,
	imageKey,
	imagePath,
	parseImagePath,
	UPLOAD_ROUTES,
} from "@orcai/s3";
import {
	checkUpload,
	claimStagedUpload,
	isS3NotFound,
	sendDeleteObjectCommand,
	sendGetObjectCommand,
	sendHeadObjectCommand,
} from "@orcai/s3/server";
import type { UploadFileObject } from "@orcai/schema";
import { eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { v4 as uuidv4 } from "uuid";
import * as AppErrors from "@/lib/effect/utils/errors";

const ROUTE_BY_OWNER = {
	user: "profileImage",
	organization: "organizationLogo",
} as const;

const imageBucket = UPLOAD_ROUTES.profileImage.bucket;

const ownerNotFound = (owner: ImageOwner) =>
	owner.kind === "user"
		? new AppErrors.NotFoundError({
				reason: "USER_NOT_FOUND",
				message: "User not found",
			})
		: new AppErrors.NotFoundError({
				reason: "ORGANIZATION_NOT_FOUND",
				message: "Organization not found",
			});

/** The owner's current image path, its row locked until the transaction ends. */
const lockOwner = (owner: ImageOwner) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const [row] =
			owner.kind === "user"
				? yield* db
						.select({
							path: dbSchema.user.image,
						})
						.from(dbSchema.user)
						.where(eq(dbSchema.user.id, owner.userId))
						.for("update")
				: yield* db
						.select({
							path: dbSchema.organization.logo,
						})
						.from(dbSchema.organization)
						.where(eq(dbSchema.organization.id, owner.organizationId))
						.for("update");
		if (!row) return yield* Effect.fail(ownerNotFound(owner));
		return row.path;
	});

const storePath = (owner: ImageOwner, path: string | null) =>
	Effect.gen(function* () {
		const db = yield* DB;
		if (owner.kind === "user")
			yield* db
				.update(dbSchema.user)
				.set({
					image: path,
				})
				.where(eq(dbSchema.user.id, owner.userId));
		else
			yield* db
				.update(dbSchema.organization)
				.set({
					logo: path,
				})
				.where(eq(dbSchema.organization.id, owner.organizationId));
	});

/** Swaps the owner's image path under its row lock and answers the one it replaced. */
const replacePath = (owner: ImageOwner, path: string | null) =>
	Effect.gen(function* () {
		const db = yield* DB;
		return yield* db.transaction(() =>
			Effect.gen(function* () {
				const previous = yield* lockOwner(owner);
				yield* storePath(owner, path);
				return previous;
			}),
		);
	});

const deleteObject = (key: string, what: string) =>
	sendDeleteObjectCommand({
		bucket: imageBucket,
		key,
	}).pipe(Effect.catchCause((cause) => logErrorCause(what, cause)));

/**
 * Deletes the objects of image paths no column references any more. Best
 * effort: a failure is logged and leaves a small unreferenced object.
 */
export const deleteImages = (paths: readonly (string | null)[]) =>
	Effect.forEach(
		paths,
		(path) => {
			const parsed = path ? parseImagePath(path) : undefined;
			return parsed
				? deleteObject(parsed.key, "Image not deleted")
				: Effect.void;
		},
		{
			concurrency: 5,
			discard: true,
		},
	);

/**
 * Makes an upload the owner's picture or logo: checks the upload against
 * `uploaderId` and the owner's route, claims the staged WebP under a fresh
 * key below `images/`, and stores its path. The replaced image is deleted
 * after the swap. A retried call never rewrites a published key.
 */
export const setImage = (params: {
	owner: ImageOwner;
	uploaderId: UserId;
	file: UploadFileObject;
}) =>
	Effect.gen(function* () {
		const upload = yield* checkUpload({
			file: params.file,
			route: ROUTE_BY_OWNER[params.owner.kind],
			userId: params.uploaderId,
		});
		const id = uuidv4();
		const key = imageKey(params.owner, id);
		const path = imagePath(params.owner, id);
		const previous = yield* claimStagedUpload(upload, {
			key,
			commit: replacePath(params.owner, path).pipe(
				Effect.tapError(() => deleteObject(key, "Unused image not deleted")),
			),
		});

		yield* deleteImages([
			previous,
		]);

		return path;
	}).pipe(
		Effect.catchTag("UploadRejected", (rejected) =>
			Effect.fail(AppErrors.uploadRefused(rejected)),
		),
	);

/** Clears the owner's picture or logo and deletes its object. */
export const removeImage = (owner: ImageOwner) =>
	replacePath(owner, null).pipe(
		Effect.flatMap((previous) =>
			deleteImages([
				previous,
			]),
		),
	);

/** The object of an image path a column still references; undefined otherwise. */
export const referencedImage = (path: string) =>
	Effect.gen(function* () {
		const parsed = parseImagePath(path);
		if (!parsed) return undefined;
		const db = yield* DB;
		const [row] =
			parsed.owner.kind === "user"
				? yield* db
						.select({
							path: dbSchema.user.image,
						})
						.from(dbSchema.user)
						.where(eq(dbSchema.user.id, parsed.owner.userId))
				: yield* db
						.select({
							path: dbSchema.organization.logo,
						})
						.from(dbSchema.organization)
						.where(eq(dbSchema.organization.id, parsed.owner.organizationId));
		return row?.path === path ? parsed : undefined;
	});

/** The bytes of a stored image; undefined when the object is gone. */
export const readImage = (key: string) =>
	sendGetObjectCommand({
		bucket: imageBucket,
		key,
	}).pipe(
		Effect.map((object) =>
			object.Body
				? {
						body: object.Body,
						size: object.ContentLength,
					}
				: undefined,
		),
		Effect.catchIf(isS3NotFound, () => Effect.succeed(undefined)),
	);

/** Revalidated on every use, so a removal or a sign-out applies at once. */
const CACHE_HEADERS = {
	"Cache-Control": "private, no-cache",
	"X-Content-Type-Options": "nosniff",
};

const notFound = () =>
	new Response("Not Found", {
		status: 404,
	});

const imageExists = (key: string) =>
	sendHeadObjectCommand({
		bucket: imageBucket,
		key,
	}).pipe(
		Effect.as(true),
		Effect.catchIf(isS3NotFound, () => Effect.succeed(false)),
	);

/**
 * The HTTP answer for an image path: the WebP while a column references it
 * and its object exists, 304 when `ifNoneMatch` names it, 404 otherwise.
 */
export const imageResponse = (path: string, ifNoneMatch: string | null) =>
	Effect.gen(function* () {
		const image = yield* referencedImage(path);
		if (!image) return notFound();

		// A key is never rewritten, so its id identifies the bytes.
		const etag = `"${image.id}"`;
		const cached = ifNoneMatch?.split(",").some((tag) => tag.trim() === etag);
		if (cached)
			return (yield* imageExists(image.key))
				? new Response(null, {
						status: 304,
						headers: {
							...CACHE_HEADERS,
							ETag: etag,
						},
					})
				: notFound();

		const object = yield* readImage(image.key);
		if (!object) return notFound();
		return new Response(object.body.transformToWebStream(), {
			headers: {
				...CACHE_HEADERS,
				ETag: etag,
				"Content-Type": "image/webp",
				...(object.size === undefined
					? {}
					: {
							"Content-Length": String(object.size),
						}),
			},
		});
	});
