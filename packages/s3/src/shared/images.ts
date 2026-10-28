import type { OrganizationId, UserId } from "@orcai/core";
import { organizationIdSchema, userIdSchema } from "@orcai/schema";

/** Profile pictures and organisation logos live here; no lifecycle rule matches it. */
export const IMAGE_PREFIX = "images/";

const ROUTE_PREFIX = "/api/";

/** Whose picture or logo an image is. */
export type ImageOwner =
	| {
			kind: "user";
			userId: UserId;
	  }
	| {
			kind: "organization";
			organizationId: OrganizationId;
	  };

const PATH_PATTERN =
	/^\/api\/images\/(users|organizations)\/([^/]+)\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.webp$/;

const ownerOf = (scope: string | undefined, ownerId: string | undefined) => {
	if (scope === "users") {
		const userId = userIdSchema.safeParse(ownerId);
		return userId.success
			? ({
					kind: "user",
					userId: userId.data,
				} satisfies ImageOwner)
			: undefined;
	}
	const organizationId = organizationIdSchema.safeParse(ownerId);
	return organizationId.success
		? ({
				kind: "organization",
				organizationId: organizationId.data,
			} satisfies ImageOwner)
		: undefined;
};

/**
 * The app path of a new image, which `user.image` and `organization.logo`
 * hold: `/api/images/<users|organizations>/<ownerId>/<id>.webp`.
 */
export const imagePath = (owner: ImageOwner, id: string) =>
	owner.kind === "user"
		? `${ROUTE_PREFIX}${IMAGE_PREFIX}users/${owner.userId}/${id}.webp`
		: `${ROUTE_PREFIX}${IMAGE_PREFIX}organizations/${owner.organizationId}/${id}.webp`;

/** The owner, id and object key of an image path; undefined for anything else. */
export const parseImagePath = (path: string) => {
	const match = PATH_PATTERN.exec(path);
	const owner = match ? ownerOf(match[1], match[2]) : undefined;
	return match && owner
		? {
				owner,
				id: match[3],
				key: path.slice(ROUTE_PREFIX.length),
			}
		: undefined;
};
