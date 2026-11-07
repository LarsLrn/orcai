// A1: committed revocations must close mutation access before tuple delivery.
import { expect, test } from "bun:test";
import { DB, dbSchema } from "@orcai/db";
import { and, eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { getEntityCapabilities } from "@/lib/authz/entity-capabilities";
import { Procedures } from "@/lib/orpc/implementation/procedures";
import { appIntegration, TIMEOUT } from "@/lib/testing/app-integration";

const {
	run,
	organizationWith,
	caller,
	createAsset,
	queueBehindOrganizationLock,
} = appIntegration();

const refused = (operation: Promise<unknown>) =>
	operation.then(
		() => false,
		() => true,
	);

for (const action of [
	"save",
	"delete",
	"grant",
] as const) {
	test(
		`a revoked ${action === "save" ? "editor" : "manager"} cannot ${action} while tuple deletion is pending`,
		async () => {
			const {
				organizationId,
				actors: [owner, member, recipient],
				zedToken,
			} = await organizationWith([
				"member",
				"member",
				"member",
			]);
			const p = await run(Procedures);
			const { call, observe, token } = caller(zedToken);
			const { asset, zedToken: created } = await createAsset(
				owner,
				organizationId,
			);
			observe(created);
			await call(owner, (o) =>
				p.resource.grant(
					{
						resourceType: "asset",
						resourceId: asset.id,
						role: action === "save" ? "editor" : "manager",
						principals: [
							{
								principalType: "user",
								principalId: member.user.id,
							},
						],
					},
					o,
				),
			);
			const before = await run(
				getEntityCapabilities({
					entityType: "asset",
					entityId: asset.id,
					userId: member.user.id,
					organizationId,
					zedToken: token(),
				}),
			);
			expect(before.read).toBe(true);
			expect(before.use).toBe(true);
			expect(before.edit).toBe(true);
			expect(before.delete).toBe(action !== "save");
			expect(before.manage_access).toBe(action !== "save");
			expect(before.download).toBe(true);
			expect(before.fork).toBe(true);
			// Failure injection: keep delivered tuples while the fresh grant is revoked in Postgres.
			// This matches a committed revocation whose outbox delivery is pending.
			await run(
				Effect.gen(function* () {
					yield* (yield* DB)
						.update(dbSchema.resourceGrant)
						.set({
							revokedAt: new Date(),
						})
						.where(
							and(
								eq(dbSchema.resourceGrant.resourceId, asset.id),
								eq(dbSchema.resourceGrant.principalId, member.user.id),
							),
						);
				}),
			);
			const capabilities = await run(
				getEntityCapabilities({
					entityType: "asset",
					zedToken: token(),
					entityId: asset.id,
					userId: member.user.id,
					organizationId,
				}),
			);
			expect(capabilities.read).toBe(false);
			expect(capabilities.use).toBe(false);
			expect(capabilities.edit).toBe(false);
			expect(capabilities.delete).toBe(false);
			expect(capabilities.manage_access).toBe(false);
			expect(capabilities.download).toBe(false);
			expect(capabilities.fork).toBe(false);
			const aliases = await run(
				getEntityCapabilities({
					entityType: "asset",
					entityId: asset.id,
					userId: member.user.id,
					organizationId,
					zedToken: token(),
					permissions: [
						"download",
						"fork",
					],
				}),
			);
			expect(aliases.download).toBe(false);
			expect(aliases.fork).toBe(false);
			expect(
				await refused(
					call(member, (o) =>
						p.asset.find(
							{
								id: asset.id,
							},
							o,
						),
					),
				),
			).toBe(true);
			const outcome = await refused(
				action === "save"
					? call(member, (o) =>
							p.asset.save(
								{
									id: asset.id,
									title: "Revoked edit",
								},
								o,
							),
						)
					: action === "delete"
						? call(member, (o) =>
								p.asset.delete(
									{
										refs: [
											{
												id: asset.id,
											},
										],
									},
									o,
								),
							)
						: call(member, (o) =>
								p.resource.grant(
									{
										resourceType: "asset",
										resourceId: asset.id,
										role: "viewer",
										principals: [
											{
												principalType: "user",
												principalId: recipient.user.id,
											},
										],
									},
									o,
								),
							),
			);
			const stored = await call(owner, (o) =>
				p.asset.find(
					{
						id: asset.id,
					},
					o,
				),
			).catch(() => undefined);
			expect(outcome).toBe(true);
			expect(stored?.data.title).toBe(asset.title);
			expect(
				await refused(
					call(recipient, (o) =>
						p.asset.find(
							{
								id: asset.id,
							},
							o,
						),
					),
				),
			).toBe(true);
		},
		TIMEOUT,
	);
}

/** An asset of a manager's, and a member editing it through a group. */
const editedThroughGroup = async () => {
	const {
		organizationId,
		actors: [owner, member],
		zedToken,
	} = await organizationWith([
		"manager",
		"member",
	]);
	const p = await run(Procedures);
	const { call, observe } = caller(zedToken);
	const { asset, zedToken: created } = await createAsset(owner, organizationId);
	observe(created);
	const { data: team } = await call(owner, (o) =>
		p.group.create(
			{
				name: "Integration editors",
				description: null,
			},
			o,
		),
	);
	await call(owner, (o) =>
		p.group.addMembers(
			{
				groupId: team.id,
				userIds: [
					member.user.id,
				],
			},
			o,
		),
	);
	await call(owner, (o) =>
		p.resource.grant(
			{
				resourceType: "asset",
				resourceId: asset.id,
				role: "editor",
				principals: [
					{
						principalType: "group",
						principalId: team.id,
					},
				],
			},
			o,
		),
	);
	const save = (title: string) =>
		call(member, (o) =>
			p.asset.save(
				{
					id: asset.id,
					title,
				},
				o,
			),
		);
	const title = async () =>
		(
			await call(owner, (o) =>
				p.asset.find(
					{
						id: asset.id,
					},
					o,
				),
			)
		).data.title;
	const generation = () =>
		run(
			Effect.gen(function* () {
				const [row] = yield* (yield* DB)
					.select({
						generation: dbSchema.asset.processingGeneration,
					})
					.from(dbSchema.asset)
					.where(eq(dbSchema.asset.id, asset.id));
				return row?.generation;
			}),
		);
	const prepareAgain = (actor: typeof owner) =>
		call(actor, (o) =>
			p.asset.prepareAgain(
				{
					id: asset.id,
				},
				o,
			),
		);
	return {
		organizationId,
		owner,
		member,
		assetId: asset.id,
		teamId: team.id,
		save,
		title,
		generation,
		prepareAgain,
		revoke: () =>
			call(owner, (o) =>
				p.resource.revoke(
					{
						resourceType: "asset",
						resourceId: asset.id,
						principalType: "group",
						principalId: team.id,
					},
					o,
				),
			),
	};
};

test(
	"a member removed from an editing group cannot save while tuple deletion is pending",
	async () => {
		const { member, teamId, save, title } = await editedThroughGroup();
		await save("Group edit");
		// Failure injection: the membership ends in Postgres while its tuple stays.
		await run(
			Effect.gen(function* () {
				yield* (yield* DB)
					.update(dbSchema.groupMember)
					.set({
						removedAt: new Date(),
					})
					.where(
						and(
							eq(dbSchema.groupMember.groupId, teamId),
							eq(dbSchema.groupMember.userId, member.user.id),
						),
					);
			}),
		);

		expect(await refused(save("Removed edit"))).toBe(true);
		expect(await title()).toBe("Group edit");
	},
	TIMEOUT,
);

test(
	"a save queued behind a revocation of its grant is refused",
	async () => {
		const { organizationId, save, title, revoke } = await editedThroughGroup();
		await save("Group edit");
		let queued: boolean | undefined;

		await queueBehindOrganizationLock(organizationId, revoke, async () => {
			queued = await refused(save("Queued edit"));
		});

		expect(queued).toBe(true);
		expect(await title()).toBe("Group edit");
	},
	TIMEOUT,
);

test(
	"preparing again queued behind a revocation of its grant is refused",
	async () => {
		const {
			organizationId,
			owner,
			member,
			assetId,
			generation,
			prepareAgain,
			revoke,
		} = await editedThroughGroup();
		await run(
			Effect.gen(function* () {
				yield* (yield* DB)
					.update(dbSchema.asset)
					.set({
						processingStatus: "completed",
					})
					.where(eq(dbSchema.asset.id, assetId));
			}),
		);
		const before = await generation();
		let queued: boolean | undefined;

		await queueBehindOrganizationLock(organizationId, revoke, async () => {
			queued = await refused(prepareAgain(member));
		});

		expect(queued).toBe(true);
		expect(await generation()).toBe(before);
		// The asset could be prepared again: its owner still can.
		await prepareAgain(owner);
		expect(await generation()).not.toBe(before);
	},
	TIMEOUT,
);
