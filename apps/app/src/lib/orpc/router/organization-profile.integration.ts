import { describe, expect, test } from "bun:test";
import type { BlockId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type { CatalogueKind, OrganizationDescription } from "@orcai/schema";
import * as Effect from "effect/Effect";
import {
	type Actor,
	authzIntegration,
	TIMEOUT,
} from "@/lib/authz/authz-integration";
import { Procedures } from "@/lib/orpc/implementation/procedures";

const { run, organizationWith, procedureOptions } = authzIntegration();

const outcomeOf = (operation: Promise<unknown>) =>
	operation.then(
		() => "ok",
		(error: { _tag?: string; code?: string }) =>
			error._tag ?? error.code ?? "failed",
	);

const description: OrganizationDescription = {
	type: "doc",
	content: [
		{
			type: "paragraph",
			content: [
				{
					type: "text",
					text: "Write to ",
				},
				{
					type: "text",
					text: "the lab",
					marks: [
						{
							type: "link",
							attrs: {
								href: "mailto:lab@uni.example",
							},
						},
					],
				},
			],
		},
	],
};

/**
 * A home organisation with an admin author and a member, listing a ready bot
 * with its behaviour and repository, and holding an unlisted repository and a
 * listed draft behaviour; and a second organisation whose admin and viewer
 * belong only to it.
 */
const organizations = async () => {
	const {
		organizationId: home,
		actors: [author, member],
		zedToken,
	} = await organizationWith([
		"admin",
		"member",
	]);
	const {
		organizationId: other,
		actors: [otherAdmin, viewer],
	} = await organizationWith([
		"admin",
		"viewer",
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

	const names = {
		unlisted: `Unlisted repository ${crypto.randomUUID()}`,
		draft: `Draft behaviour ${crypto.randomUUID()}`,
	};
	const createBlock = (
		type: "template" | "database",
		status: "ready" | "draft" = "ready",
		name = `Profile ${type} ${crypto.randomUUID()}`,
	): Promise<BlockId> =>
		call(author, (options) =>
			procedures.block.create(
				type === "template"
					? {
							type,
							name,
							description: null,
							contentJson: null,
							status,
							config: {
								systemPrompt: "Answer from the handbook.",
							},
						}
					: {
							type,
							name,
							description: null,
							contentJson: null,
							status,
							assets: [],
							config: {
								minReferences: 1,
								maxReferences: 5,
								defaultReferences: 3,
							},
						},
				options,
			),
		).then(({ data }) => data.id);
	const list = (resourceType: "bot" | "block", resourceId: string) =>
		call(author, (options) =>
			procedures.resource.setVisibility(
				{
					resourceType,
					resourceId,
					visibility: "public",
					listBlockIds: [],
				} as Parameters<typeof procedures.resource.setVisibility>[0],
				options,
			),
		);

	const template = await createBlock("template");
	const repository = await createBlock("database");
	await createBlock("database", "ready", names.unlisted);
	const draft = await createBlock("template", "draft", names.draft);
	const { data: bot } = await call(author, (options) =>
		procedures.bot.save(
			{
				name: `Profile bot ${crypto.randomUUID()}`,
				description: "Integration bot",
				status: "ready",
				templateBlockId: template,
				databaseBlockIds: [
					repository,
				],
			},
			options,
		),
	);
	await list("block", template);
	await list("block", repository);
	await list("bot", bot.id);
	await list("block", draft);

	return {
		home,
		other,
		author,
		member,
		otherAdmin,
		viewer,
		procedures,
		call,
		names,
		bot: bot.id,
	};
};

describe("organization.profile", () => {
	test(
		"shows any signed-in user only the allowlisted fields and the listed counts",
		async () => {
			const s = await organizations();
			await s.call(s.author, (options) =>
				s.procedures.organization.update(
					{
						id: s.home,
						description,
					},
					options,
				),
			);

			const { data: profile } = await s.call(s.viewer, (options) =>
				s.procedures.organization.profile(
					{
						id: s.home,
					},
					options,
				),
			);

			expect(Object.keys(profile).sort()).toEqual([
				"description",
				"id",
				"listed",
				"logo",
				"name",
			]);
			expect(profile.id).toBe(s.home);
			expect(profile.description).toEqual(description);
			expect(profile.listed).toEqual({
				bot: 1,
				behaviour: 1,
				repository: 1,
			});
			const serialized = JSON.stringify(profile);
			for (const hidden of [
				s.names.unlisted,
				s.names.draft,
				s.author.user.email,
				s.member.user.email,
				s.member.user.id,
			])
				expect(serialized).not.toContain(hidden);

			expect(
				await outcomeOf(
					s.call(s.viewer, (options) =>
						s.procedures.organization.find(
							{
								id: s.home,
							},
							options,
						),
					),
				),
			).toBe("ForbiddenError");
		},
		TIMEOUT,
	);

	test(
		"counts what the catalogue lists for the organisation, not what it added",
		async () => {
			const s = await organizations();
			// The second organisation adds the bot, as an install does.
			await run(
				Effect.gen(function* () {
					yield* (yield* DB).insert(dbSchema.resourceScope).values({
						resourceType: "bot",
						resourceId: s.bot,
						organizationId: s.other,
						isPrimary: false,
						assignedBy: s.otherAdmin.user.id,
					});
				}),
			);

			const counted = async (organizationId: typeof s.home) =>
				(
					await s.call(s.viewer, (options) =>
						s.procedures.organization.profile(
							{
								id: organizationId,
							},
							options,
						),
					)
				).data.listed;
			const catalogued = async (kind: CatalogueKind) =>
				(
					await s.call(s.viewer, (options) =>
						s.procedures.catalogue.list(
							{
								pageIndex: 0,
								pageSize: 50,
								kind,
								organizationIds: [
									s.home,
								],
							},
							options,
						),
					)
				).rowCount;

			expect(await counted(s.home)).toEqual({
				bot: await catalogued("bot"),
				behaviour: await catalogued("behaviour"),
				repository: await catalogued("repository"),
			});
			expect(await counted(s.other)).toEqual({
				bot: 0,
				behaviour: 0,
				repository: 0,
			});

			await s.call(s.author, (options) =>
				s.procedures.resource.setVisibility(
					{
						resourceType: "bot",
						resourceId: s.bot,
						visibility: "private",
						listBlockIds: [],
					},
					options,
				),
			);
			expect((await counted(s.home)).bot).toBe(0);
		},
		TIMEOUT,
	);

	test(
		"edits the description only for the organisation's admins, with safe links",
		async () => {
			const s = await organizations();
			const update = (actor: Actor, value: unknown) =>
				outcomeOf(
					s.call(actor, (options) =>
						s.procedures.organization.update(
							{
								id: s.home,
								description: value as OrganizationDescription,
							},
							options,
						),
					),
				);

			expect(await update(s.member, description)).toBe("ForbiddenError");
			expect(await update(s.otherAdmin, description)).toBe("ForbiddenError");
			expect(
				await update(s.author, {
					type: "doc",
					content: [
						{
							type: "paragraph",
							content: [
								{
									type: "text",
									text: "x",
									marks: [
										{
											type: "link",
											attrs: {
												href: "javascript:alert(1)",
											},
										},
									],
								},
							],
						},
					],
				}),
			).toBe("BAD_REQUEST");
			expect(await update(s.author, description)).toBe("ok");
			expect(await update(s.author, null)).toBe("ok");

			const { data: profile } = await s.call(s.member, (options) =>
				s.procedures.organization.profile(
					{
						id: s.home,
					},
					options,
				),
			);
			expect(profile.description).toBeNull();
		},
		TIMEOUT,
	);

	test(
		"is not found for an organisation that does not exist",
		async () => {
			const s = await organizations();
			expect(
				await outcomeOf(
					s.call(s.viewer, (options) =>
						s.procedures.organization.profile(
							{
								id: crypto.randomUUID() as typeof s.home,
							},
							options,
						),
					),
				),
			).toBe("NotFoundError");
		},
		TIMEOUT,
	);
});
