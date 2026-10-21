import type { AssetId, BlockId, BotId, UserId } from "@orcai/core";
import type { ResourceGrantRole, ResourceIdentity } from "@orcai/schema";
import { expect, type Page } from "@playwright/test";
import { type ApiClient, ZED_TOKEN_COOKIE, type ZedTokenStore } from "../api";
import { rejection } from "../authorization";
import { runId } from "../organisation";

/** A name no other test uses, so a spec finds its own resources. */
export const authzName = (label: string): string =>
	`E2E Authz ${label} ${runId()}`;

export const TEMPLATE_PROMPT = "Created by the authz slice.";

export const templateBlock = (name: string) => ({
	type: "template" as const,
	name,
	status: "ready" as const,
	config: {
		systemPrompt: TEMPLATE_PROMPT,
	},
});

const DATABASE_CONFIG = {
	minReferences: 1,
	maxReferences: 5,
	defaultReferences: 3,
};

/** A repository: the database block a bot links and the only kind carrying assets. */
export const databaseBlock = (name: string, assets: AssetId[] = []) => ({
	type: "database" as const,
	name,
	status: "ready" as const,
	assets,
	config: DATABASE_CONFIG,
});

/** `block.update` input for a repository; `assets` is the full list it keeps. */
export const databaseBlockUpdate = (
	id: BlockId,
	name: string,
	assets: AssetId[],
) => ({
	id,
	...databaseBlock(name, assets),
});

/** An asset row without an upload: `asset.create` needs no bytes and no worker. */
export const assetRow = (title: string) => ({
	title,
	size: 1024,
	fileType: "txt" as const,
});

/** `asset.save` input renaming an existing asset. */
export const assetRename = (id: AssetId, title: string) => ({
	id,
	title,
	metadata: {
		showReference: true,
		relevance: "medium" as const,
	},
});

/** `bot.save` input linking a template and repositories. */
export const botSave = (params: {
	name: string;
	templateBlockId: BlockId | null;
	databaseBlockIds?: BlockId[];
	id?: BotId;
}) => ({
	id: params.id,
	name: params.name,
	description: "Created by the authz slice.",
	status: "draft" as const,
	templateBlockId: params.templateBlockId,
	databaseBlockIds: params.databaseBlockIds ?? [],
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
		await client.user.listAccess({
			id: userId,
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
