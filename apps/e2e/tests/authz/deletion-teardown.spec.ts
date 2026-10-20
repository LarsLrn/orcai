import { expectDenied } from "../../fixtures/authorization";
import {
	accessIds,
	assetRow,
	authzName,
	botSave,
	databaseBlock,
	grantUser,
	templateBlock,
} from "../../fixtures/authz/resources";
import { expect, test } from "../../fixtures/index";

test("authz: deleting a bot takes away the read it passed on to its blocks", async ({
	api,
	org,
}) => {
	const member = api.as("member");
	const viewer = api.as("viewer");
	const block = await member.block.create(
		templateBlock(authzName("Deleted Bot Template")),
	);
	const bot = await member.bot.save(
		botSave({
			name: authzName("Deleted Bot"),
			templateBlockId: block.data.id,
		}),
	);
	await grantUser(
		member,
		{
			resourceType: "bot",
			resourceId: bot.data.id,
		},
		org.users.viewer.id,
		"viewer",
	);

	const found = await viewer.block.find({
		id: block.data.id,
	});
	expect(found.data.id).toBe(block.data.id);
	expect(await accessIds(viewer, org.users.viewer.id)).toContain(bot.data.id);

	await member.bot.delete({
		refs: [
			{
				id: bot.data.id,
			},
		],
	});

	await expectDenied(
		viewer.block.find({
			id: block.data.id,
		}),
	);
	expect(await accessIds(member, org.users.member.id)).not.toContain(
		bot.data.id,
	);
	expect(await accessIds(viewer, org.users.viewer.id)).not.toContain(
		bot.data.id,
	);
});

test("authz: a deleted block leaves no access entry behind", async ({
	api,
	org,
}) => {
	const member = api.as("member");
	const viewer = api.as("viewer");
	const block = await member.block.create(
		templateBlock(authzName("Deleted Block")),
	);
	await grantUser(
		member,
		{
			resourceType: "block",
			resourceId: block.data.id,
		},
		org.users.viewer.id,
		"viewer",
	);
	expect(await accessIds(viewer, org.users.viewer.id)).toContain(block.data.id);

	await member.block.delete({
		refs: [
			{
				id: block.data.id,
			},
		],
	});

	expect(await accessIds(member, org.users.member.id)).not.toContain(
		block.data.id,
	);
	expect(await accessIds(viewer, org.users.viewer.id)).not.toContain(
		block.data.id,
	);
});

test("authz: a deleted asset leaves no access entry and no repository link behind", async ({
	api,
	org,
}) => {
	const member = api.as("member");
	const viewer = api.as("viewer");
	const asset = await member.asset.create(assetRow(authzName("Deleted Asset")));
	await grantUser(
		member,
		{
			resourceType: "asset",
			resourceId: asset.data.id,
		},
		org.users.viewer.id,
		"viewer",
	);
	const repository = await member.block.create(
		databaseBlock(authzName("Deleted Asset Repository"), [
			asset.data.id,
		]),
	);
	expect(await accessIds(viewer, org.users.viewer.id)).toContain(asset.data.id);

	await member.asset.delete({
		refs: [
			{
				id: asset.data.id,
			},
		],
	});

	expect(await accessIds(member, org.users.member.id)).not.toContain(
		asset.data.id,
	);
	expect(await accessIds(viewer, org.users.viewer.id)).not.toContain(
		asset.data.id,
	);

	const found = await member.block.find({
		id: repository.data.id,
	});
	expect(found.assets ?? []).toEqual([]);
});
