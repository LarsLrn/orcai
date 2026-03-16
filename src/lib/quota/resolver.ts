import { and, asc, desc, eq, isNotNull, isNull, or } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { dbSchema } from "@/db/schema";
import { DB } from "@/lib/effect/services/drizzle";
import { ensureOpenQuotaPeriod } from "@/lib/quota/period";

interface ResolvedQuotaPoolCandidate {
	pool: typeof dbSchema.quotaPool.$inferSelect;
	period: typeof dbSchema.quotaPeriod.$inferSelect;
	ledger: typeof dbSchema.quotaLedger.$inferSelect;
	meteringMode: (typeof dbSchema.provider.$inferSelect)["meteringMode"];
}

interface QuotaResolutionResult {
	winningPool: ResolvedQuotaPoolCandidate | null;
	orderedCandidatePoolIds: string[];
}

interface CandidateRow {
	pool: typeof dbSchema.quotaPool.$inferSelect;
	meteringMode: (typeof dbSchema.provider.$inferSelect)["meteringMode"];
}

export const resolveQuotaPool = (params: {
	orgId: string;
	userId: string;
	providerId: string;
	providerModelId?: string | null;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;

		const modelScopeCondition = params.providerModelId
			? or(
					eq(dbSchema.quotaPool.providerModelId, params.providerModelId),
					isNull(dbSchema.quotaPool.providerModelId),
				)
			: isNull(dbSchema.quotaPool.providerModelId);

		const candidateRows = yield* db
			.select({
				pool: dbSchema.quotaPool,
				meteringMode: dbSchema.provider.meteringMode,
			})
			.from(dbSchema.quotaPool)
			.innerJoin(
				dbSchema.provider,
				and(
					eq(dbSchema.provider.id, dbSchema.quotaPool.providerId),
					eq(dbSchema.provider.organizationId, params.orgId),
					eq(dbSchema.provider.enabled, true),
				),
			)
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
					eq(dbSchema.group.organizationId, params.orgId),
					isNull(dbSchema.group.deletedAt),
				),
			)
			.leftJoin(
				dbSchema.groupMember,
				and(
					eq(dbSchema.groupMember.groupId, dbSchema.group.id),
					eq(dbSchema.groupMember.userId, params.userId),
					isNull(dbSchema.groupMember.removedAt),
				),
			)
			.where(
				and(
					eq(dbSchema.quotaPool.organizationId, params.orgId),
					eq(dbSchema.quotaPool.providerId, params.providerId),
					eq(dbSchema.quotaPool.isActive, true),
					modelScopeCondition,
					or(
						and(
							eq(dbSchema.group.kind, "system"),
							eq(dbSchema.group.systemKey, "all_members"),
						),
						isNotNull(dbSchema.groupMember.id),
					),
				),
			)
			.orderBy(
				desc(dbSchema.quotaPool.priority),
				asc(dbSchema.quotaPool.createdAt),
				asc(dbSchema.quotaPool.id),
			)
			.pipe(Effect.map((rows) => rows as CandidateRow[]));

		const deduped = new Map<string, CandidateRow>();
		for (const row of candidateRows) {
			if (!deduped.has(row.pool.id)) {
				deduped.set(row.pool.id, row);
			}
		}

		const orderedRows = Array.from(deduped.values()).sort((a, b) => {
			const aSpecificity =
				params.providerModelId &&
				a.pool.providerModelId === params.providerModelId
					? 2
					: 1;
			const bSpecificity =
				params.providerModelId &&
				b.pool.providerModelId === params.providerModelId
					? 2
					: 1;

			if (aSpecificity !== bSpecificity) {
				return bSpecificity - aSpecificity;
			}

			if (a.pool.priority !== b.pool.priority) {
				return b.pool.priority - a.pool.priority;
			}

			const aCreated = a.pool.createdAt?.getTime() ?? 0;
			const bCreated = b.pool.createdAt?.getTime() ?? 0;
			if (aCreated !== bCreated) {
				return aCreated - bCreated;
			}

			return a.pool.id.localeCompare(b.pool.id);
		});

		const orderedCandidatePoolIds = orderedRows.map((row) => row.pool.id);

		const firstCandidate = orderedRows[0];
		if (!firstCandidate) {
			return {
				winningPool: null,
				orderedCandidatePoolIds,
			} satisfies QuotaResolutionResult;
		}

		const period = yield* ensureOpenQuotaPeriod({
			quotaPoolId: firstCandidate.pool.id,
			periodType: firstCandidate.pool.periodType,
			budgetAmount: firstCandidate.pool.budgetAmount,
		});

		return {
			winningPool: {
				pool: firstCandidate.pool,
				period: period.period,
				ledger: period.ledger,
				meteringMode: firstCandidate.meteringMode,
			} satisfies ResolvedQuotaPoolCandidate,
			orderedCandidatePoolIds,
		} satisfies QuotaResolutionResult;
	});
