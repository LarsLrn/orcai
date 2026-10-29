import {
	type GroupId,
	isModelProviderKind,
	type ModelId,
	type OrganizationId,
	type ProviderId,
	type ProviderKind,
} from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import {
	type ModelCapability,
	modelUnusableReason,
	type OrganizationCheck,
	type OrganizationReadiness,
} from "@orcai/schema";
import { and, count, eq, gt, inArray, isNull, notExists } from "drizzle-orm";
import * as Effect from "effect/Effect";

/** The organisation's configuration that readiness reads. */
export interface ReadinessSnapshot {
	readonly providers: readonly {
		readonly id: ProviderId;
		readonly kind: ProviderKind;
		readonly enabled: boolean;
	}[];
	readonly models: readonly {
		readonly id: ModelId;
		readonly providerId: ProviderId;
		readonly capabilities: readonly ModelCapability[] | null;
		readonly isDeprecated: boolean;
	}[];
	/** Active pools, each with the live groups it is actively assigned to. */
	readonly pools: readonly {
		readonly providerId: ProviderId;
		readonly modelId: string | null;
		readonly groupIds: readonly GroupId[];
	}[];
	readonly assistantModelId: ModelId | null;
	readonly utilityModelId: ModelId | null;
	readonly memberCount: number;
	readonly pendingInvitations: number;
}

type Model = ReadinessSnapshot["models"][number];
type Pool = ReadinessSnapshot["pools"][number];

const check = (
	id: OrganizationCheck["id"],
	severity: OrganizationCheck["severity"],
	passed: boolean,
	reasons: {
		readonly ok: OrganizationCheck["reason"];
		readonly failed: OrganizationCheck["reason"];
	},
	params?: OrganizationCheck["params"],
): OrganizationCheck => ({
	id,
	severity,
	status: passed ? "ok" : severity === "required" ? "failing" : "warning",
	reason: passed ? reasons.ok : reasons.failed,
	...(params && {
		params,
	}),
});

const rules = (snapshot: ReadinessSnapshot) => {
	const providers = new Map(
		snapshot.providers
			.filter((provider) => isModelProviderKind(provider.kind))
			.map((provider) => [
				provider.id,
				provider,
			]),
	);
	// The rule a turn applies to its model.
	const chatReady = (model: Model | undefined) => {
		const provider = model && providers.get(model.providerId);
		return (
			!!model &&
			!!provider &&
			modelUnusableReason(
				{
					capabilities: model.capabilities,
					isDeprecated: model.isDeprecated,
					providerEnabled: provider.enabled,
				},
				"turn",
			) === undefined
		);
	};
	const covers = (pool: Pool, model: Model) =>
		pool.groupIds.length > 0 &&
		pool.providerId === model.providerId &&
		(pool.modelId === null || pool.modelId === model.id);
	const chatModels = snapshot.models.filter(chatReady);
	// Models that may chat once an admin sets their capabilities.
	const unsetModels = snapshot.models.filter(
		(model) =>
			model.capabilities === null &&
			!model.isDeprecated &&
			providers.get(model.providerId)?.enabled,
	);

	return {
		providers,
		chatReady,
		covers,
		chatModels,
		unsetModels,
		chatPools: snapshot.pools.filter((pool) =>
			chatModels.some((model) => covers(pool, model)),
		),
	};
};

/** The groups whose members a chat pool reaches. */
export const chatPoolGroupIds = (snapshot: ReadinessSnapshot) => [
	...new Set(rules(snapshot).chatPools.flatMap((pool) => pool.groupIds)),
];

/**
 * The checks as of `snapshot`; required ones fail where a turn would.
 * `uncoveredMembers` counts members no group of `chatPoolGroupIds` reaches.
 */
export const evaluateReadiness = (
	snapshot: ReadinessSnapshot,
	uncoveredMembers: number,
): OrganizationReadiness => {
	const { providers, chatReady, covers, chatModels, unsetModels, chatPools } =
		rules(snapshot);
	const assistantModel = snapshot.models.find(
		(model) => model.id === snapshot.assistantModelId,
	);
	const assistantReady = chatReady(assistantModel);

	return {
		checks: [
			check(
				"provider",
				"required",
				[
					...providers.values(),
				].some((provider) => provider.enabled),
				{
					ok: "PROVIDER_READY",
					failed: "PROVIDER_MISSING",
				},
			),
			check(
				"chat-model",
				"required",
				chatModels.length > 0,
				{
					ok: "CHAT_MODEL_READY",
					failed:
						unsetModels.length > 0
							? "CHAT_MODEL_CAPABILITIES_UNKNOWN"
							: "CHAT_MODEL_MISSING",
				},
				chatModels.length === 0 && unsetModels.length > 0
					? {
							count: unsetModels.length,
						}
					: undefined,
			),
			check("pool", "required", chatPools.length > 0, {
				ok: "POOL_READY",
				failed: "POOL_MISSING",
			}),
			check("assistant-model", "required", assistantReady, {
				ok: "ASSISTANT_MODEL_READY",
				failed: snapshot.assistantModelId
					? "ASSISTANT_MODEL_UNUSABLE"
					: "ASSISTANT_MODEL_MISSING",
			}),
			check(
				"assistant-pool",
				"required",
				assistantReady &&
					snapshot.pools.some(
						(pool) => assistantModel && covers(pool, assistantModel),
					),
				{
					ok: "ASSISTANT_POOL_READY",
					failed: "ASSISTANT_POOL_MISSING",
				},
			),
			check("utility-model", "recommended", !!snapshot.utilityModelId, {
				ok: "UTILITY_MODEL_READY",
				failed: "UTILITY_MODEL_MISSING",
			}),
			check(
				"members",
				"recommended",
				snapshot.memberCount + snapshot.pendingInvitations > 1,
				{
					ok: "MEMBERS_INVITED",
					failed: "MEMBERS_NONE_INVITED",
				},
			),
			check(
				"coverage",
				"recommended",
				uncoveredMembers === 0,
				{
					ok: "COVERAGE_COMPLETE",
					failed: "COVERAGE_GAPS",
				},
				{
					count: uncoveredMembers,
				},
			),
		],
	};
};

const readSnapshot = (organizationId: OrganizationId) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const [
			providers,
			models,
			poolAssignments,
			[organization],
			[members],
			[invitations],
		] = yield* Effect.all(
			[
				db
					.select({
						id: dbSchema.provider.id,
						kind: dbSchema.provider.kind,
						enabled: dbSchema.provider.enabled,
					})
					.from(dbSchema.provider)
					.where(eq(dbSchema.provider.organizationId, organizationId)),
				db
					.select({
						id: dbSchema.model.id,
						providerId: dbSchema.model.providerId,
						capabilities: dbSchema.model.capabilities,
						isDeprecated: dbSchema.model.isDeprecated,
					})
					.from(dbSchema.model)
					.innerJoin(
						dbSchema.provider,
						eq(dbSchema.provider.id, dbSchema.model.providerId),
					)
					.where(eq(dbSchema.provider.organizationId, organizationId)),
				db
					.select({
						poolId: dbSchema.quotaPool.id,
						providerId: dbSchema.quotaPool.providerId,
						modelId: dbSchema.quotaPool.modelId,
						groupId: dbSchema.group.id,
					})
					.from(dbSchema.quotaPool)
					.innerJoin(
						dbSchema.quotaPoolGroupAssignment,
						and(
							eq(
								dbSchema.quotaPoolGroupAssignment.quotaPoolId,
								dbSchema.quotaPool.id,
							),
							eq(dbSchema.quotaPoolGroupAssignment.isActive, true),
						),
					)
					.innerJoin(
						dbSchema.group,
						and(
							eq(dbSchema.group.id, dbSchema.quotaPoolGroupAssignment.groupId),
							eq(dbSchema.group.organizationId, organizationId),
							isNull(dbSchema.group.deletedAt),
						),
					)
					.where(
						and(
							eq(dbSchema.quotaPool.organizationId, organizationId),
							eq(dbSchema.quotaPool.isActive, true),
						),
					),
				db
					.select({
						assistantModelId: dbSchema.organization.assistantModelId,
						utilityModelId: dbSchema.organization.utilityModelId,
					})
					.from(dbSchema.organization)
					.where(eq(dbSchema.organization.id, organizationId)),
				db
					.select({
						count: count(),
					})
					.from(dbSchema.member)
					.where(eq(dbSchema.member.organizationId, organizationId)),
				db
					.select({
						count: count(),
					})
					.from(dbSchema.invitation)
					.where(
						and(
							eq(dbSchema.invitation.organizationId, organizationId),
							eq(dbSchema.invitation.status, "pending"),
							gt(dbSchema.invitation.expiresAt, new Date()),
						),
					),
			],
			{
				concurrency: "unbounded",
			},
		);

		const pools = new Map<string, ReadinessSnapshot["pools"][number]>();
		for (const row of poolAssignments) {
			const pool = pools.get(row.poolId);
			pools.set(row.poolId, {
				providerId: row.providerId,
				modelId: row.modelId,
				groupIds: [
					...(pool?.groupIds ?? []),
					row.groupId,
				],
			});
		}

		return {
			providers,
			models,
			pools: [
				...pools.values(),
			],
			assistantModelId: organization?.assistantModelId ?? null,
			utilityModelId: organization?.utilityModelId ?? null,
			memberCount: members?.count ?? 0,
			pendingInvitations: invitations?.count ?? 0,
		} satisfies ReadinessSnapshot;
	});

/** Members reached by none of `groupIds`: All Members reaches everyone, other groups their active members. */
const countUncoveredMembers = (
	organizationId: OrganizationId,
	groupIds: readonly GroupId[],
) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const [row] = yield* db
			.select({
				count: count(),
			})
			.from(dbSchema.member)
			.where(
				and(
					eq(dbSchema.member.organizationId, organizationId),
					notExists(
						db
							.select({
								id: dbSchema.group.id,
							})
							.from(dbSchema.group)
							.where(
								and(
									inArray(dbSchema.group.id, [
										...groupIds,
									]),
									eq(dbSchema.group.systemKey, "all_members"),
								),
							),
					),
					notExists(
						db
							.select({
								id: dbSchema.groupMember.id,
							})
							.from(dbSchema.groupMember)
							.where(
								and(
									eq(dbSchema.groupMember.userId, dbSchema.member.userId),
									inArray(dbSchema.groupMember.groupId, [
										...groupIds,
									]),
									isNull(dbSchema.groupMember.removedAt),
								),
							),
					),
				),
			);
		return row?.count ?? 0;
	});

/** What `organizationId` still needs before its members can chat, derived live. */
export const organizationReadiness = (organizationId: OrganizationId) =>
	Effect.gen(function* () {
		const snapshot = yield* readSnapshot(organizationId);
		const groupIds = chatPoolGroupIds(snapshot);
		const uncovered =
			groupIds.length === 0
				? snapshot.memberCount
				: yield* countUncoveredMembers(organizationId, groupIds);
		return evaluateReadiness(snapshot, uncovered);
	});
