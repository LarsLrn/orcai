import { describe, expect, test } from "bun:test";
import type {
	AssetId,
	BlockId,
	BotId,
	ChatId,
	GroupId,
	UserId,
} from "@orcai/core";
import type { TupleMutation } from "@orcai/spice-db";
import { AUTHZ } from "@/settings/constants";
import {
	buildTeardownMutations,
	chunkRelationshipMutations,
	type TeardownState,
} from "./resource-lifecycle";

const id = (n: number) =>
	`00000000-0000-4000-8000-${n.toString().padStart(12, "0")}`;

const botId = id(1) as BotId;
const blockId = id(2) as BlockId;
const otherBlockId = id(5) as BlockId;
const assetId = id(3) as AssetId;
const chatId = id(4) as ChatId;
const ownerId = id(10) as UserId;
const userId = id(11) as UserId;
const groupId = id(12) as GroupId;

const state = (overrides: Partial<TeardownState>): TeardownState => ({
	resourceType: "bot",
	resourceIds: [],
	owners: [],
	activeGrants: [],
	botBlocks: [],
	botChats: [],
	blockAssets: [],
	...overrides,
});

const key = (mutation: TupleMutation) =>
	`${mutation.resourceType}:${mutation.resourceId}#${mutation.relation}@${mutation.subjectType}:${mutation.subjectId}${mutation.subjectRelation ? `#${mutation.subjectRelation}` : ""}`;

describe("buildTeardownMutations", () => {
	test("deletes the public tuple of every resource and its owner", () => {
		const mutations = buildTeardownMutations(
			state({
				resourceType: "block",
				resourceIds: [
					blockId,
					otherBlockId,
				],
				owners: [
					{
						resourceId: blockId,
						userId: ownerId,
					},
				],
			}),
		);

		expect(mutations.map(key)).toEqual([
			`block:${blockId}#public@user:*`,
			`block:${otherBlockId}#public@user:*`,
			`block:${blockId}#owner@user:${ownerId}`,
		]);
		expect(mutations.every((mutation) => mutation.operation === "delete")).toBe(
			true,
		);
	});

	test("deletes user grants and group grants through the group's members", () => {
		const mutations = buildTeardownMutations(
			state({
				resourceType: "asset",
				activeGrants: [
					{
						resourceId: assetId,
						principalType: "user",
						principalId: userId,
						role: "editor",
					},
					{
						resourceId: assetId,
						principalType: "group",
						principalId: groupId,
						role: "viewer",
					},
				],
			}),
		);

		expect(mutations.map(key)).toEqual([
			`asset:${assetId}#editor@user:${userId}`,
			`asset:${assetId}#viewer@group:${groupId}#member`,
		]);
	});

	test("deletes a bot's block and chat links", () => {
		const mutations = buildTeardownMutations(
			state({
				resourceType: "bot",
				botBlocks: [
					{
						botId,
						blockId,
					},
				],
				botChats: [
					{
						chatId,
						botId,
					},
				],
			}),
		);

		expect(mutations.map(key)).toEqual([
			`block:${blockId}#bot@bot:${botId}`,
			`chat:${chatId}#bot@bot:${botId}`,
		]);
	});

	test("deletes a block's bot links", () => {
		const mutations = buildTeardownMutations(
			state({
				resourceType: "block",
				botBlocks: [
					{
						botId,
						blockId,
					},
				],
			}),
		);

		expect(mutations.map(key)).toEqual([
			`block:${blockId}#bot@bot:${botId}`,
		]);
	});

	test("deletes an asset's block links", () => {
		const mutations = buildTeardownMutations(
			state({
				resourceType: "asset",
				blockAssets: [
					{
						blockId,
						assetId,
					},
				],
			}),
		);

		expect(mutations.map(key)).toEqual([
			`asset:${assetId}#block@block:${blockId}`,
		]);
	});

	test("names each relationship once", () => {
		const mutations = buildTeardownMutations(
			state({
				resourceType: "bot",
				resourceIds: [
					botId,
					botId,
				],
				owners: [
					{
						resourceId: botId,
						userId: ownerId,
					},
					{
						resourceId: botId,
						userId: ownerId,
					},
				],
				activeGrants: [
					{
						resourceId: botId,
						principalType: "user",
						principalId: userId,
						role: "viewer",
					},
					{
						resourceId: botId,
						principalType: "user",
						principalId: userId,
						role: "viewer",
					},
				],
				botBlocks: [
					{
						botId,
						blockId,
					},
					{
						botId,
						blockId,
					},
				],
			}),
		);

		expect(mutations.map(key)).toEqual([
			`bot:${botId}#public@user:*`,
			`bot:${botId}#owner@user:${ownerId}`,
			`bot:${botId}#viewer@user:${userId}`,
			`block:${blockId}#bot@bot:${botId}`,
		]);
	});
});

describe("chunkRelationshipMutations", () => {
	test("splits mutations into events of at most the configured size", () => {
		const mutations = buildTeardownMutations(
			state({
				resourceType: "bot",
				botChats: Array.from(
					{
						length: AUTHZ.outboxMutationsPerEvent * 2 + 1,
					},
					(_, index) => ({
						chatId: id(1000 + index) as ChatId,
						botId,
					}),
				),
			}),
		);

		const chunks = chunkRelationshipMutations(mutations);

		expect(chunks.map((chunk) => chunk.length)).toEqual([
			500,
			500,
			1,
		]);
		expect(chunks.flat()).toEqual(mutations);
	});
});
