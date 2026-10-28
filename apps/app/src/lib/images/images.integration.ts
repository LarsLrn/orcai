import { describe, expect, test } from "bun:test";
import { DB, dbSchema } from "@orcai/db";
import { parseImagePath, UPLOAD_ROUTES } from "@orcai/s3";
import { isS3NotFound, sendHeadObjectCommand } from "@orcai/s3/server";
import type { StorageUploadRoute, UploadFileObject } from "@orcai/schema";
import { eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import {
	type Actor,
	authzIntegration,
	TIMEOUT,
} from "@/lib/authz/authz-integration";
import { Procedures } from "@/lib/orpc/implementation/procedures";
import { referencedImage } from "./images";

const { run, organizationWith, procedureOptions } = authzIntegration();

const procedures = () => run(Procedures);

const rejection = (operation: Promise<unknown>) =>
	operation.then(
		() => undefined,
		(error: unknown) => error,
	);

/** A 1x1 lossless WebP. */
const WEBP = Buffer.from(
	"UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==",
	"base64",
);

/** Signs an upload of {@link WEBP} as `actor` and PUTs it, with `contentType` if given. */
const upload = async (
	actor: Actor,
	route: StorageUploadRoute,
	contentType?: string,
): Promise<{
	file: UploadFileObject;
	response: Response;
}> => {
	const { storage } = await procedures();
	const { data } = await run(
		storage.createUploadUrls(
			{
				route,
				files: [
					{
						name: "picture.webp",
						size: WEBP.byteLength,
						type: "image/webp",
					},
				],
			},
			await procedureOptions(actor),
		),
	);
	const [target] = data;
	if (target?.mode !== "single") throw new Error("expected a single upload");
	const response = await fetch(target.signedUrl, {
		method: "PUT",
		headers: {
			...target.headers,
			...(contentType
				? {
						"Content-Type": contentType,
					}
				: {}),
		},
		body: WEBP,
	});
	return {
		file: target.file,
		response,
	};
};

const stagedUpload = async (actor: Actor, route: StorageUploadRoute) => {
	const { file, response } = await upload(actor, route);
	expect(response.ok).toBe(true);
	return file;
};

const imageOf = (actor: Actor) =>
	run(
		Effect.gen(function* () {
			const db = yield* DB;
			const [row] = yield* db
				.select({
					image: dbSchema.user.image,
				})
				.from(dbSchema.user)
				.where(eq(dbSchema.user.id, actor.user.id));
			return row?.image ?? null;
		}),
	);

/** Whether the object behind a key exists, and its content type. */
const head = (key: string) =>
	run(
		sendHeadObjectCommand({
			bucket: UPLOAD_ROUTES.profileImage.bucket,
			key,
		}).pipe(
			Effect.map((object) => object.ContentType),
			Effect.catchIf(isS3NotFound, () => Effect.succeed(undefined)),
		),
	);

const keyOf = (path: string | null) => {
	const parsed = path ? parseImagePath(path) : undefined;
	if (!parsed) throw new Error(`not an image path: ${path}`);
	return parsed.key;
};

const stagingKeyOf = (file: UploadFileObject) => file.objectMetadata.key ?? "";

const setImage = async (actor: Actor, file: UploadFileObject) => {
	const { user } = await procedures();
	return run(
		user.setImage(
			{
				file,
			},
			await procedureOptions(actor),
		),
	);
};

describe("profile pictures", () => {
	test(
		"a commit stores the path and moves the object out of staging",
		async () => {
			const {
				actors: [member],
			} = await organizationWith([
				"member",
			]);
			const file = await stagedUpload(member, "profileImage");

			const { data } = await setImage(member, file);

			expect(await imageOf(member)).toBe(data.image);
			expect(parseImagePath(data.image)?.owner).toEqual({
				kind: "user",
				userId: member.user.id,
			});
			expect(await head(keyOf(data.image))).toBe("image/webp");
			expect(await head(stagingKeyOf(file))).toBeUndefined();
			expect(await run(referencedImage(data.image))).toBeDefined();
		},
		TIMEOUT,
	);

	test(
		"a replacement deletes the old object and a removal clears the column",
		async () => {
			const {
				actors: [member],
			} = await organizationWith([
				"member",
			]);
			const first = await setImage(
				member,
				await stagedUpload(member, "profileImage"),
			);
			const second = await setImage(
				member,
				await stagedUpload(member, "profileImage"),
			);

			expect(second.data.image).not.toBe(first.data.image);
			expect(await head(keyOf(first.data.image))).toBeUndefined();
			expect(await run(referencedImage(first.data.image))).toBeUndefined();

			const { user } = await procedures();
			await run(user.removeImage({}, await procedureOptions(member)));

			expect(await imageOf(member)).toBeNull();
			expect(await head(keyOf(second.data.image))).toBeUndefined();
			expect(await run(referencedImage(second.data.image))).toBeUndefined();
		},
		TIMEOUT,
	);

	test(
		"another user's staged upload is refused",
		async () => {
			const {
				actors: [owner, forger],
			} = await organizationWith([
				"member",
				"member",
			]);
			const file = await stagedUpload(owner, "profileImage");

			expect(await rejection(setImage(forger, file))).toMatchObject({
				reason: "UPLOAD_REQUEST_INVALID",
			});
			expect(await imageOf(forger)).toBeNull();
			expect(await head(stagingKeyOf(file))).toBe("image/webp");
		},
		TIMEOUT,
	);

	test(
		"only small WebP files are signed, stored and committed",
		async () => {
			const {
				actors: [member],
			} = await organizationWith([
				"member",
			]);
			const { storage } = await procedures();
			const sign = async (type: string, size: number) =>
				rejection(
					run(
						storage.createUploadUrls(
							{
								route: "profileImage",
								files: [
									{
										name: "picture",
										size,
										type,
									},
								],
							},
							await procedureOptions(member),
						),
					),
				);

			expect(await sign("image/png", WEBP.byteLength)).toMatchObject({
				reason: "UPLOAD_FILE_TYPE_INVALID",
			});
			expect(await sign("image/webp", 256 * 1024 + 1)).toMatchObject({
				reason: "UPLOAD_FILE_TOO_LARGE",
			});

			// The store may keep a PUT whose type differs from the signed one.
			const mislabelled = await upload(member, "profileImage", "image/svg+xml");
			expect(await rejection(setImage(member, mislabelled.file))).toMatchObject(
				{
					reason: mislabelled.response.ok
						? "UPLOAD_FILE_TYPE_INVALID"
						: "UPLOAD_FILE_MISSING",
				},
			);

			const file = await stagedUpload(member, "profileImage");
			expect(
				await rejection(
					setImage(member, {
						...file,
						size: file.size + 1,
					}),
				),
			).toMatchObject({
				reason: "UPLOAD_FILE_SIZE_MISMATCH",
			});
			expect(
				await rejection(
					setImage(member, {
						...file,
						size: 256 * 1024 + 1,
					}),
				),
			).toMatchObject({
				reason: "UPLOAD_FILE_TOO_LARGE",
			});
			expect(
				await rejection(
					setImage(member, await stagedUpload(member, "organizationLogo")),
				),
			).toMatchObject({
				reason: "UPLOAD_REQUEST_INVALID",
			});
			expect(await imageOf(member)).toBeNull();
		},
		TIMEOUT,
	);

	test(
		"a retried commit never rewrites the published image",
		async () => {
			const {
				actors: [member],
			} = await organizationWith([
				"member",
			]);
			const file = await stagedUpload(member, "profileImage");
			const { data } = await setImage(member, file);

			expect(await rejection(setImage(member, file))).toMatchObject({
				reason: "UPLOAD_FILE_MISSING",
			});
			expect(await imageOf(member)).toBe(data.image);
			expect(await head(keyOf(data.image))).toBe("image/webp");
		},
		TIMEOUT,
	);

	test(
		"a commit racing a removal leaves the column and the objects consistent",
		async () => {
			const {
				actors: [member],
			} = await organizationWith([
				"member",
			]);
			const { data: first } = await setImage(
				member,
				await stagedUpload(member, "profileImage"),
			);
			const file = await stagedUpload(member, "profileImage");
			const { user } = await procedures();

			const [committed] = await Promise.all([
				setImage(member, file),
				run(user.removeImage({}, await procedureOptions(member))),
			]);

			const current = await imageOf(member);
			expect([
				null,
				committed.data.image,
			]).toContain(current);
			expect(await head(keyOf(first.image))).toBeUndefined();
			expect(await head(keyOf(committed.data.image))).toBe(
				current ? "image/webp" : undefined,
			);
		},
		TIMEOUT,
	);
});

describe("organisation logos", () => {
	test(
		"only an organisation admin sets and removes the logo",
		async () => {
			const {
				organizationId,
				actors: [admin, member],
				zedToken,
			} = await organizationWith([
				"admin",
				"member",
			]);
			const { organization } = await procedures();

			expect(
				await rejection(
					run(
						organization.setLogo(
							{
								id: organizationId,
								file: await stagedUpload(member, "organizationLogo"),
							},
							await procedureOptions(member, zedToken),
						),
					),
				),
			).toMatchObject({
				_tag: "ForbiddenError",
			});

			const { data } = await run(
				organization.setLogo(
					{
						id: organizationId,
						file: await stagedUpload(admin, "organizationLogo"),
					},
					await procedureOptions(admin, zedToken),
				),
			);
			expect(parseImagePath(data.logo)?.owner).toEqual({
				kind: "organization",
				organizationId,
			});
			const found = await run(
				organization.find(
					{
						id: organizationId,
					},
					await procedureOptions(member, zedToken),
				),
			);
			expect(found.data.logo).toBe(data.logo);

			expect(
				await rejection(
					run(
						organization.removeLogo(
							{
								id: organizationId,
							},
							await procedureOptions(member, zedToken),
						),
					),
				),
			).toMatchObject({
				_tag: "ForbiddenError",
			});
			await run(
				organization.removeLogo(
					{
						id: organizationId,
					},
					await procedureOptions(admin, zedToken),
				),
			);
			expect(await head(keyOf(data.logo))).toBeUndefined();
		},
		TIMEOUT,
	);
});
