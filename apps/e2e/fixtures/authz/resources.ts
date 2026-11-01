import type { AssetId, BlockId, BotId, UserId } from "@orcai/core";
import type { ResourceGrantRole, ResourceIdentity } from "@orcai/schema";
import { expect, type Page } from "@playwright/test";
import { type ApiClient, ZED_TOKEN_COOKIE, type ZedTokenStore } from "../api";
import { rejection } from "../authorization";
import { runId } from "../organisation";

/** A name no other test uses, so a spec finds its own resources. */
export const authzName = (label: string): string =>
	`E2E Authz ${label} ${runId()}`;

export const BEHAVIOUR_PROMPT = "Created by the authz slice.";

export const behaviourInput = (name: string) => ({
	type: "behaviour" as const,
	name,
	status: "ready" as const,
	config: {
		systemPrompt: BEHAVIOUR_PROMPT,
	},
});

const DATABASE_CONFIG = {
	minPassages: 1,
	maxPassages: 5,
	defaultPassages: 3,
};

/** A repository: the repository a bot links and the only kind carrying assets. */
export const repositoryInput = (name: string, assets: AssetId[] = []) => ({
	type: "repository" as const,
	name,
	status: "ready" as const,
	assets,
	config: DATABASE_CONFIG,
});

/** `block.update` input for a repository; `assets` is the full list it keeps. */
export const repositoryUpdate = (
	id: BlockId,
	name: string,
	assets: AssetId[],
) => ({
	id,
	...repositoryInput(name, assets),
});

/** `asset.save` input renaming an existing asset. */
export const assetRename = (id: AssetId, title: string) => ({
	id,
	title,
	metadata: {},
});

/** `bot.save` input linking a behaviour and repositories. */
export const botSave = (params: {
	name: string;
	behaviourId: BlockId | null;
	repositoryIds?: BlockId[];
	id?: BotId;
}) => ({
	id: params.id,
	name: params.name,
	description: "Created by the authz slice.",
	status: "draft" as const,
	behaviourId: params.behaviourId,
	repositoryIds: params.repositoryIds ?? [],
});

/** Grant one user a role on a resource. */
export const grantUser = async (
	client: ApiClient,
	resource: ResourceIdentity,
	userId: UserId,
	role: ResourceGrantRole,
): Promise<void> => {
	await client.resource.grant({
		...resource,
		principals: [
			{
				principalType: "user",
				principalId: userId,
			},
		],
		role,
	});
};

/** Assert an attach was refused because an added asset is not readable. */
export const expectAssetLinkForbidden = async (
	promise: Promise<unknown>,
): Promise<void> => {
	const error = await rejection(promise);

	expect(error.code).toBe("FORBIDDEN");
	expect(error.data).toMatchObject({
		reason: "ASSET_LINK_FORBIDDEN",
	});
};

/** The resource ids a user's access overview lists. */
export const accessIds = async (
	client: ApiClient,
	userId: UserId,
): Promise<string[]> =>
	(
		await client.organizationMember.listAccess({
			userId,
			pageSize: 1000,
		})
	).data.map((entry) => String(entry.resourceId));

/** The active role a principal holds on a resource, read from its grant list. */
export const grantRole = async (
	client: ApiClient,
	resource: ResourceIdentity,
	principalId: UserId,
): Promise<ResourceGrantRole | undefined> => {
	const grants = await client.resource.listGrants(resource);

	return grants.data.find(
		(grant) => grant.principalId === principalId && grant.revokedAt === null,
	)?.role;
};

/** Carry the browser's newest zedToken into the API clients, so their reads see its writes. */
export const adoptPageZedToken = async (
	page: Page,
	zedTokens: ZedTokenStore,
): Promise<void> => {
	const cookie = (await page.context().cookies()).find(
		(candidate) => candidate.name === ZED_TOKEN_COOKIE,
	);

	if (cookie) zedTokens.write(cookie.value);
};
