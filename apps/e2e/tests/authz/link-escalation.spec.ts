import { randomUUID } from "node:crypto";
import { assetIdSchema } from "@orcai/schema";
import { expectDenied, expectForbidden } from "../../fixtures/authorization";
import {
	assetRename,
	assetRow,
	authzName,
	botSave,
	databaseBlock,
	databaseBlockUpdate,
	expectAssetLinkForbidden,
	grantUser,
	TEMPLATE_PROMPT,
	templateBlock,
} from "../../fixtures/authz/resources";
import { expect, test } from "../../fixtures/index";

test("authz: linking a readable block into one's own bot does not grant edit on it", async ({
	api,
	org,
}) => {
	const member = api.as("member");
	const manager = api.as("manager");
	const name = authzName("Linked Template");
	const block = await member.block.create(templateBlock(name));
	await grantUser(
		member,
		{
			resourceType: "block",
			resourceId: block.data.id,
		},
		org.users.manager.id,
		"viewer",
	);

	await manager.bot.save(
		botSave({
			name: authzName("Manager Bot"),
			templateBlockId: block.data.id,
		}),
	);

	await expectForbidden(
		manager.block.update({
			id: block.data.id,
			...templateBlock(authzName("Hijacked")),
			config: {
				systemPrompt: "Changed through a linking bot.",
			},
		}),
	);

	const found = await member.block.find({
		id: block.data.id,
	});
	expect(found.data.name).toBe(name);
	expect(found.data.config).toEqual({
		systemPrompt: TEMPLATE_PROMPT,
	});
});

test("authz: an editor of a bot reads its blocks but cannot edit them", async ({
	api,
	org,
}) => {
	const member = api.as("member");
	const manager = api.as("manager");
	const block = await member.block.create(
		templateBlock(authzName("Bot Template")),
	);
	const bot = await member.bot.save(
		botSave({
			name: authzName("Shared Bot"),
			templateBlockId: block.data.id,
		}),
	);
	await grantUser(
		member,
		{
			resourceType: "bot",
			resourceId: bot.data.id,
		},
		org.users.manager.id,
		"editor",
	);

	const renamed = authzName("Renamed Bot");
	const saved = await manager.bot.save(
		botSave({
			id: bot.data.id,
			name: renamed,
			templateBlockId: block.data.id,
		}),
	);
	expect(saved.data.name).toBe(renamed);

	const editor = await manager.bot.findEditor({
		id: bot.data.id,
	});
	expect(editor.data.templateBlock?.id).toBe(block.data.id);
	expect(editor.data.templateBlock?.capabilities).toMatchObject({
		read: true,
		edit: false,
	});

	await expectForbidden(
		manager.block.update({
			id: block.data.id,
			...templateBlock(authzName("Hijacked")),
		}),
	);
});

test("authz: a repository cannot be created with an asset the caller cannot read", async ({
	api,
}) => {
	const member = api.as("member");
	const manager = api.as("manager");
	const asset = await member.asset.create(assetRow(authzName("Private Asset")));
	const name = authzName("Rejected Repository");

	await expectAssetLinkForbidden(
		manager.block.create(
			databaseBlock(name, [
				asset.data.id,
			]),
		),
	);

	const blocks = await manager.block.list({
		pageIndex: 0,
		pageSize: 1000,
		filters: {
			type: "database",
		},
	});
	expect(blocks.data.map((block) => block.name)).not.toContain(name);

	await expectDenied(
		manager.asset.find({
			id: asset.data.id,
		}),
	);
});

test("authz: adding an unreadable asset to a repository leaves it unchanged", async ({
	api,
}) => {
	const member = api.as("member");
	const manager = api.as("manager");
	const own = await manager.asset.create(assetRow(authzName("Own Asset")));
	const foreign = await member.asset.create(
		assetRow(authzName("Foreign Asset")),
	);
	const name = authzName("Own Repository");
	const repository = await manager.block.create(
		databaseBlock(name, [
			own.data.id,
		]),
	);

	await expectAssetLinkForbidden(
		manager.block.update(
			databaseBlockUpdate(repository.data.id, authzName("Renamed"), [
				own.data.id,
				foreign.data.id,
			]),
		),
	);

	const found = await manager.block.find({
		id: repository.data.id,
	});
	expect(found.data.name).toBe(name);
	expect(found.assets?.map((asset) => asset.id)).toEqual([
		own.data.id,
	]);
});

test("authz: a repository cannot be created with an asset id that does not exist", async ({
	api,
}) => {
	await expectAssetLinkForbidden(
		api.as("manager").block.create(
			databaseBlock(authzName("Unknown Asset Repository"), [
				assetIdSchema.parse(randomUUID()),
			]),
		),
	);
});

test("authz: attaching a readable asset passes read on, not edit", async ({
	api,
	org,
}) => {
	const member = api.as("member");
	const manager = api.as("manager");
	const title = authzName("Shared Asset");
	const asset = await member.asset.create(assetRow(title));
	await grantUser(
		member,
		{
			resourceType: "asset",
			resourceId: asset.data.id,
		},
		org.users.manager.id,
		"viewer",
	);

	const repository = await manager.block.create(
		databaseBlock(authzName("Attaching Repository"), [
			asset.data.id,
		]),
	);
	const found = await manager.block.find({
		id: repository.data.id,
	});
	expect(found.assets?.map((attached) => attached.id)).toEqual([
		asset.data.id,
	]);

	const seen = await manager.asset.find({
		id: asset.data.id,
	});
	expect(seen.data.capabilities).toMatchObject({
		read: true,
		edit: false,
	});

	await expectForbidden(
		manager.asset.save(assetRename(asset.data.id, authzName("Hijacked"))),
	);

	const unchanged = await member.asset.find({
		id: asset.data.id,
	});
	expect(unchanged.data.title).toBe(title);
});

test("authz: an editor of a repository keeps and detaches its assets without editing them", async ({
	api,
	org,
}) => {
	const member = api.as("member");
	const manager = api.as("manager");
	const asset = await member.asset.create(assetRow(authzName("Kept Asset")));
	const repository = await member.block.create(
		databaseBlock(authzName("Shared Repository"), [
			asset.data.id,
		]),
	);
	await grantUser(
		member,
		{
			resourceType: "block",
			resourceId: repository.data.id,
		},
		org.users.manager.id,
		"editor",
	);

	const renamed = authzName("Renamed Repository");
	const kept = await manager.block.update(
		databaseBlockUpdate(repository.data.id, renamed, [
			asset.data.id,
		]),
	);
	expect(kept.assets).toEqual([
		asset.data.id,
	]);

	// While attached, the repository passes read on the asset but not edit.
	const seen = await manager.asset.find({
		id: asset.data.id,
	});
	expect(seen.data.capabilities).toMatchObject({
		read: true,
		edit: false,
	});
	await expectForbidden(
		manager.asset.save(assetRename(asset.data.id, authzName("Hijacked"))),
	);

	const detached = await manager.block.update(
		databaseBlockUpdate(repository.data.id, renamed, []),
	);
	expect(detached.assets ?? []).toEqual([]);

	await expectForbidden(
		manager.asset.save(assetRename(asset.data.id, authzName("Hijacked"))),
	);
});

test("authz: an asset created in one call attaches in the next without a retry", async ({
	api,
}) => {
	const manager = api.as("manager");
	const asset = await manager.asset.create(assetRow(authzName("Fresh Asset")));

	const repository = await manager.block.create(
		databaseBlock(authzName("Fresh Repository"), [
			asset.data.id,
		]),
	);
	expect(repository.assets).toEqual([
		asset.data.id,
	]);
});
