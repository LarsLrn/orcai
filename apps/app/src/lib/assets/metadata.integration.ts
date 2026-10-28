import { describe, expect, test } from "bun:test";
import type { AssetId, OrganizationId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type { AssetMetadataType, SaveAssetInput } from "@orcai/schema";
import { createOrganization } from "@orcai/testing";
import { eq, inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { authzIntegration, TIMEOUT } from "@/lib/authz/authz-integration";
import { Procedures } from "@/lib/orpc/implementation/procedures";

const { run, signIn, procedureOptions, organizationWith, createAsset } =
	authzIntegration();

const prepared = (assetIds: AssetId[]) =>
	run(
		Effect.gen(function* () {
			yield* (yield* DB)
				.update(dbSchema.asset)
				.set({
					processingStatus: "completed",
				})
				.where(inArray(dbSchema.asset.id, assetIds));
		}),
	);

/** Gives the organisation a utility model on a provider of its own. */
const withUtilityModel = (organizationId: OrganizationId) =>
	run(
		Effect.gen(function* () {
			const db = yield* DB;
			const [provider] = yield* db
				.insert(dbSchema.provider)
				.values({
					organizationId,
					name: `Utility ${crypto.randomUUID()}`,
					kind: "openai-compatible",
					description: "",
					apiKeyEncrypted: "unused",
				})
				.returning();
			const [model] = yield* db
				.insert(dbSchema.model)
				.values({
					providerId: provider.id,
					providerModelId: `utility-${crypto.randomUUID()}`,
					name: "Utility model",
					description: "",
					capabilities: [
						"text",
					],
				})
				.returning();
			yield* db
				.update(dbSchema.organization)
				.set({
					utilityModelId: model.id,
				})
				.where(eq(dbSchema.organization.id, organizationId));
		}),
	);

const rejection = (promise: Promise<unknown>) =>
	promise.then(
		() => undefined,
		(error: unknown) => error,
	);

describe("asset metadata generation", () => {
	test(
		"needs edit on the asset to generate or dismiss",
		async () => {
			const {
				organizationId,
				actors: [owner, other],
				zedToken,
			} = await organizationWith([
				"member",
				"member",
			]);
			const { asset } = await createAsset(owner, organizationId);
			await prepared([
				asset.id,
			]);
			const procedures = await run(Procedures);

			expect(
				await rejection(
					run(
						procedures.asset.generateMetadata(
							{
								id: asset.id,
							},
							await procedureOptions(other, zedToken),
						),
					),
				),
			).toMatchObject({
				_tag: "ForbiddenError",
			});
			expect(
				await rejection(
					run(
						procedures.asset.dismissMetadataSuggestion(
							{
								id: asset.id,
								generation: 0,
							},
							await procedureOptions(other, zedToken),
						),
					),
				),
			).toMatchObject({
				_tag: "ForbiddenError",
			});
		},
		TIMEOUT,
	);

	test(
		"counts only prepared library assets of the active organisation the user can edit",
		async () => {
			const {
				organizationId,
				actors: [owner, other],
			} = await organizationWith([
				"member",
				"member",
			]);
			const mine = await createAsset(owner, organizationId);
			const unprepared = await createAsset(owner, organizationId);
			const theirs = await createAsset(other, organizationId);
			const { organization: elsewhere, zedToken } = await run(
				createOrganization({
					members: [
						{
							userId: owner.user.id,
							role: "member",
						},
					],
				}),
			);
			const ownerElsewhere = await signIn(elsewhere.id, owner.user.id);
			const inOtherOrganization = await createAsset(
				ownerElsewhere,
				elsewhere.id,
			);
			await prepared([
				mine.asset.id,
				theirs.asset.id,
				inOtherOrganization.asset.id,
			]);
			const procedures = await run(Procedures);
			const count = async (actor: typeof owner, token: string | undefined) =>
				(
					await run(
						procedures.asset.missingMetadata(
							{},
							await procedureOptions(actor, token),
						),
					)
				).count;

			expect(unprepared.asset.id).toBeDefined();
			expect(
				await count(
					owner,
					inOtherOrganization.zedToken ?? theirs.zedToken ?? zedToken,
				),
			).toBe(1);
			expect(
				await count(ownerElsewhere, inOtherOrganization.zedToken ?? zedToken),
			).toBe(1);
		},
		TIMEOUT,
	);

	test(
		"an asset reports its own organisation's utility model, whichever is active",
		async () => {
			const {
				organizationId: active,
				actors: [owner],
			} = await organizationWith([
				"member",
			]);
			const { organization: other } = await run(
				createOrganization({
					members: [
						{
							userId: owner.user.id,
							role: "member",
						},
					],
				}),
			);
			await withUtilityModel(other.id);
			const ownerInOther = await signIn(other.id, owner.user.id);
			const { asset, zedToken } = await createAsset(ownerInOther, other.id);
			const procedures = await run(Procedures);

			expect(
				(
					await run(
						procedures.asset.find(
							{
								id: asset.id,
							},
							await procedureOptions(owner, zedToken),
						),
					)
				).data,
			).toMatchObject({
				organizationId: other.id,
				utilityModel: true,
			});
			expect(active).not.toBe(other.id);
		},
		TIMEOUT,
	);

	test(
		"outside readers learn nothing about the asset's organisation",
		async () => {
			const {
				organizationId,
				actors: [owner],
				zedToken,
			} = await organizationWith([
				"admin",
			]);
			const {
				actors: [outsider],
			} = await organizationWith([
				"member",
			]);
			await withUtilityModel(organizationId);
			const created = await createAsset(owner, organizationId);
			const procedures = await run(Procedures);
			const { meta } = await run(
				procedures.resource.setVisibility(
					{
						resourceType: "asset",
						resourceId: created.asset.id,
						visibility: "public",
					},
					await procedureOptions(owner, created.zedToken ?? zedToken),
				),
			);
			const find = async (actor: typeof owner) =>
				(
					await run(
						procedures.asset.find(
							{
								id: created.asset.id,
							},
							await procedureOptions(actor, meta?.zedToken),
						),
					)
				).data;

			expect(await find(outsider)).toMatchObject({
				organizationId: null,
				utilityModel: null,
			});
			expect(await find(owner)).toMatchObject({
				organizationId,
				utilityModel: true,
			});
		},
		TIMEOUT,
	);

	test(
		"a save changes only the given fields, so generated ones survive",
		async () => {
			const {
				organizationId,
				actors: [owner],
			} = await organizationWith([
				"member",
			]);
			const { asset, zedToken } = await createAsset(owner, organizationId);
			await run(
				Effect.gen(function* () {
					yield* (yield* DB)
						.update(dbSchema.asset)
						.set({
							metadata: {
								author: "Ada",
								description: "Generated meanwhile.",
							},
						})
						.where(eq(dbSchema.asset.id, asset.id));
				}),
			);
			const procedures = await run(Procedures);
			const save = async (input: Omit<SaveAssetInput, "id">) =>
				(
					await run(
						procedures.asset.save(
							{
								id: asset.id,
								...input,
							},
							await procedureOptions(owner, zedToken),
						),
					)
				).data;

			expect(
				await save({
					title: "Refund policy",
					metadata: {},
				}),
			).toMatchObject({
				title: "Refund policy",
				metadata: {
					author: "Ada",
					description: "Generated meanwhile.",
				},
			});
			expect(
				(
					await save({
						metadata: {
							author: "",
							doi: "10.1/x",
						},
					})
				).metadata,
			).toEqual({
				author: "",
				doi: "10.1/x",
				description: "Generated meanwhile.",
			});
		},
		TIMEOUT,
	);

	test(
		"a source type change drops the fields the new type does not have",
		async () => {
			const {
				organizationId,
				actors: [owner],
			} = await organizationWith([
				"member",
			]);
			const procedures = await run(Procedures);
			const saved = async (
				stored: AssetMetadataType,
				patch: AssetMetadataType,
			) => {
				const { asset, zedToken } = await createAsset(owner, organizationId);
				await run(
					Effect.gen(function* () {
						yield* (yield* DB)
							.update(dbSchema.asset)
							.set({
								metadata: stored,
							})
							.where(eq(dbSchema.asset.id, asset.id));
					}),
				);
				return (
					await run(
						procedures.asset.save(
							{
								id: asset.id,
								metadata: patch,
							},
							await procedureOptions(owner, zedToken),
						),
					)
				).data.metadata;
			};

			// The assistant's patch names only the new type.
			expect(
				await saved(
					{
						sourceType: "journal-article",
						journalName: "Journal of Policy",
						doi: "10.1/x",
						citation: "Lovelace (2026)",
					},
					{
						sourceType: "legal-text",
					},
				),
			).toEqual({
				sourceType: "legal-text",
				citation: "Lovelace (2026)",
			});
			// A review accepted the suggested type with one of its fields.
			expect(
				await saved(
					{
						sourceType: "book",
						author: "Ada",
						chapterTitle: "Notes",
					},
					{
						sourceType: "journal-article",
						journalName: "Journal of Policy",
					},
				),
			).toEqual({
				sourceType: "journal-article",
				author: "Ada",
				journalName: "Journal of Policy",
			});
			// The worker filled a journal article; the user makes it a web source.
			expect(
				await saved(
					{
						sourceType: "journal-article",
						author: "Ada",
						journalName: "Journal of Policy",
						volume: "4",
						description: "Generated.",
						language: "en",
					},
					{
						sourceType: "web-source",
						websiteName: "Policy blog",
					},
				),
			).toEqual({
				sourceType: "web-source",
				author: "Ada",
				websiteName: "Policy blog",
				description: "Generated.",
				language: "en",
			});
		},
		TIMEOUT,
	);
});
