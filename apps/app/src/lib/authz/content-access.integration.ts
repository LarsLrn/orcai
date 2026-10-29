import { describe, expect, test } from "bun:test";
import type { BlockId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { and, eq, inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { attachAssets } from "@/lib/ai/turn/attachments";
import {
	type Actor,
	authzIntegration,
	TIMEOUT,
} from "@/lib/authz/authz-integration";
import { Procedures } from "@/lib/orpc/implementation/procedures";

const { run, organizationWith, procedureOptions, createAsset } =
	authzIntegration();

const reasonOf = (operation: Promise<unknown>) =>
	operation.then(
		() => undefined,
		(error: { _tag?: string }) => error._tag,
	);

/**
 * An author's bot with a repository holding one document, shared with a
 * member who reaches the repository and the document only through the bot.
 */
const sharedRepository = async () => {
	const {
		organizationId,
		actors: [author, member],
		zedToken,
	} = await organizationWith([
		"admin",
		"member",
	]);
	const procedures = await run(Procedures);
	let token = zedToken;
	const call = async <A>(
		actor: Actor,
		operation: (
			options: Awaited<ReturnType<typeof procedureOptions>>,
		) => Effect.Effect<
			A & {
				meta?: {
					zedToken?: string;
				};
			},
			unknown
		>,
	) => {
		const result = await run(operation(await procedureOptions(actor, token)));
		token = result.meta?.zedToken ?? token;
		return result;
	};

	const {
		asset: { id: assetId },
		zedToken: assetToken,
	} = await createAsset(author, organizationId);
	token = assetToken ?? token;
	const { data: repository } = await call(author, (options) =>
		procedures.block.create(
			{
				type: "database",
				name: "Shared repository",
				description: null,
				contentJson: null,
				contentHtml: null,
				status: "ready",
				assets: [
					assetId,
				],
				config: {
					minReferences: 1,
					maxReferences: 5,
					defaultReferences: 3,
				},
			},
			options,
		),
	);
	const { data: bot } = await call(author, (options) =>
		procedures.bot.save(
			{
				name: `Content bot ${crypto.randomUUID()}`,
				description: "Integration bot",
				status: "draft",
				databaseBlockIds: [
					repository.id,
				],
			},
			options,
		),
	);
	await call(author, (options) =>
		procedures.resource.grant(
			{
				resourceType: "bot",
				resourceId: bot.id,
				role: "viewer",
				principals: [
					{
						principalType: "user",
						principalId: member.user.id,
					},
				],
			},
			options,
		),
	);

	// Owning unrelated resources must not open the shared ones.
	await createAsset(member, organizationId);
	const { data: ownBlock } = await call(member, (options) =>
		procedures.block.create(
			{
				type: "template",
				name: "Own behaviour",
				description: null,
				contentJson: null,
				contentHtml: null,
				status: "ready",
				config: {
					systemPrompt: "",
				},
			},
			options,
		),
	);
	await call(member, (options) =>
		procedures.bot.save(
			{
				name: `Own bot ${crypto.randomUUID()}`,
				description: "Integration bot",
				status: "draft",
				templateBlockId: ownBlock.id,
			},
			options,
		),
	);

	const reads = async () => ({
		block: await reasonOf(
			call(member, (options) =>
				procedures.block.find(
					{
						id: repository.id,
					},
					options,
				),
			),
		),
		asset: await reasonOf(
			call(member, (options) =>
				procedures.asset.find(
					{
						id: assetId,
					},
					options,
				),
			),
		),
		listed: {
			block: (
				await call(member, (options) =>
					procedures.block.list(
						{
							pageIndex: 0,
							pageSize: 100,
						},
						options,
					),
				)
			).data.some((block) => block.id === repository.id),
			asset: (
				await call(member, (options) =>
					procedures.asset.list(
						{
							pageIndex: 0,
							pageSize: 100,
						},
						options,
					),
				)
			).data.some((asset) => asset.id === assetId),
		},
		readiness: (
			await call(member, (options) =>
				procedures.block.readiness(
					{
						blockIds: [
							repository.id,
						],
					},
					options,
				),
			)
		).data.length,
		botBlocks: (
			await call(member, (options) =>
				procedures.block.list(
					{
						pageIndex: 0,
						pageSize: 10,
						filters: {
							botId: bot.id,
						},
					},
					options,
				),
			)
		).data.map((block) => block.id),
	});

	/** Removes the bot's link in Postgres only, as a write whose tuples are not delivered yet leaves it. */
	const unlinkWithoutTuples = () =>
		run(
			Effect.gen(function* () {
				yield* (yield* DB)
					.delete(dbSchema.botBlock)
					.where(eq(dbSchema.botBlock.botId, bot.id));
			}),
		);

	/** Changes a committed row only, as a write whose tuples are not delivered yet leaves it. */
	const withoutTuples = (change: Effect.Effect<unknown, unknown, DB>) =>
		run(change);

	/** Why the member cannot carry the document into a message or their own repository. */
	const admissions = async () => ({
		message: await reasonOf(
			run(
				attachAssets(
					[
						{
							assetId,
						},
					],
					{
						userId: member.user.id,
						zedToken: token,
					},
				),
			),
		),
		repository: await reasonOf(
			call(member, (options) =>
				procedures.block.create(
					{
						type: "database",
						name: "Copied repository",
						description: null,
						contentJson: null,
						contentHtml: null,
						status: "ready",
						assets: [
							assetId,
						],
						config: {
							minReferences: 1,
							maxReferences: 5,
							defaultReferences: 3,
						},
					},
					options,
				),
			),
		),
	});

	return {
		admissions,
		author,
		member,
		procedures,
		call,
		bot,
		repositoryId: repository.id as BlockId,
		reads,
		unlinkWithoutTuples,
		withoutTuples,
	};
};

/** What the member reads once no committed path reaches the repository. */
const closed = {
	block: "NotFoundError",
	asset: "NotFoundError",
	listed: {
		block: false,
		asset: false,
	},
	readiness: 0,
	botBlocks: [],
};

const refused = {
	message: "ForbiddenError",
	repository: "ForbiddenError",
};

describe("reading contents while tuples lag", () => {
	test(
		"revoking the member's bot grant closes the bot's contents before its tuple goes",
		async () => {
			const { admissions, member, bot, reads, withoutTuples } =
				await sharedRepository();
			await withoutTuples(
				Effect.gen(function* () {
					yield* (yield* DB)
						.update(dbSchema.resourceGrant)
						.set({
							revokedAt: new Date(),
						})
						.where(
							and(
								eq(dbSchema.resourceGrant.resourceId, bot.id),
								eq(dbSchema.resourceGrant.principalId, member.user.id),
							),
						);
				}),
			);
			expect(await reads()).toEqual(closed);
			expect(await admissions()).toEqual(refused);
		},
		TIMEOUT,
	);

	test(
		"unlisting a bot and its repository closes them to readers they reached only by listing",
		async () => {
			const {
				admissions,
				author,
				member,
				procedures,
				call,
				bot,
				repositoryId,
				reads,
				withoutTuples,
			} = await sharedRepository();
			await call(author, (options) =>
				procedures.resource.setVisibility(
					{
						resourceType: "bot",
						resourceId: bot.id,
						visibility: "public",
						listBlockIds: [
							repositoryId,
						],
					},
					options,
				),
			);
			await call(author, (options) =>
				procedures.resource.revoke(
					{
						resourceType: "bot",
						resourceId: bot.id,
						principalType: "user",
						principalId: member.user.id,
					},
					options,
				),
			);
			expect(await reads()).toMatchObject({
				block: undefined,
				asset: undefined,
			});

			await withoutTuples(
				Effect.gen(function* () {
					yield* (yield* DB)
						.update(dbSchema.resourceVisibility)
						.set({
							visibility: "private",
						})
						.where(
							inArray(dbSchema.resourceVisibility.resourceId, [
								bot.id,
								repositoryId,
							]),
						);
				}),
			);
			expect(await reads()).toEqual(closed);
			expect(await admissions()).toEqual(refused);
		},
		TIMEOUT,
	);

	test(
		"a removed bot link closes the repository and its documents before its tuple goes",
		async () => {
			const { admissions, repositoryId, reads, unlinkWithoutTuples } =
				await sharedRepository();
			expect(await reads()).toEqual({
				block: undefined,
				asset: undefined,
				listed: {
					block: true,
					asset: true,
				},
				readiness: 1,
				botBlocks: [
					repositoryId,
				],
			});

			await unlinkWithoutTuples();
			expect(await reads()).toEqual(closed);
			expect(await admissions()).toEqual(refused);
		},
		TIMEOUT,
	);

	test(
		"a direct grant and a listing keep their reads when the bot link goes",
		async () => {
			const {
				author,
				member,
				procedures,
				call,
				repositoryId,
				reads,
				unlinkWithoutTuples,
			} = await sharedRepository();
			await call(author, (options) =>
				procedures.resource.grant(
					{
						resourceType: "block",
						resourceId: repositoryId,
						role: "viewer",
						principals: [
							{
								principalType: "user",
								principalId: member.user.id,
							},
						],
					},
					options,
				),
			);
			await unlinkWithoutTuples();
			expect(await reads()).toEqual({
				block: undefined,
				asset: undefined,
				listed: {
					block: true,
					asset: true,
				},
				readiness: 1,
				botBlocks: [],
			});

			await call(author, (options) =>
				procedures.resource.revoke(
					{
						resourceType: "block",
						resourceId: repositoryId,
						principalType: "user",
						principalId: member.user.id,
					},
					options,
				),
			);
			await call(author, (options) =>
				procedures.resource.setVisibility(
					{
						resourceType: "block",
						resourceId: repositoryId,
						visibility: "public",
					},
					options,
				),
			);
			expect(await reads()).toMatchObject({
				block: undefined,
				asset: undefined,
			});
		},
		TIMEOUT,
	);
});
