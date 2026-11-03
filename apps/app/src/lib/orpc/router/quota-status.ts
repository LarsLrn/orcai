import { DB, dbSchema } from "@orcai/db";
import { openQuotaPeriod, resolveQuotaPool } from "@orcai/quota";
import { and, eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as AppErrors from "@/lib/effect/utils/errors";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireOrganizationPermission } from "@/lib/orpc/middlewares/permission";
import { usedShareOf } from "@/lib/presentation/quota-share";

const quotaStatus = authed.quota.status
	.use(requireOrganizationPermission("read"))
	.effect(function* ({ input, context }) {
		const organizationId = context.auth.session.activeOrganizationId;
		const [model] = yield* (yield* DB)
			.select({
				id: dbSchema.model.id,
			})
			.from(dbSchema.model)
			.innerJoin(
				dbSchema.provider,
				eq(dbSchema.provider.id, dbSchema.model.providerId),
			)
			.where(
				and(
					eq(dbSchema.model.id, input.modelId),
					eq(dbSchema.provider.id, input.providerId),
					eq(dbSchema.provider.organizationId, organizationId),
				),
			)
			.limit(1);
		if (!model) {
			return yield* Effect.fail(
				new AppErrors.NotFoundError({
					reason: "MODEL_NOT_FOUND",
					message: "Model not found for this provider",
				}),
			);
		}

		const { winningPool } = yield* resolveQuotaPool({
			organizationId,
			userId: context.auth.user.id,
			providerId: input.providerId,
			modelId: input.modelId,
		});

		if (!winningPool) {
			return {
				data: {
					available: false,
					pool: null,
				},
			};
		}
		// Read after a reset, the status opens the new period.
		const { period, ledger } = yield* openQuotaPeriod({
			quotaPoolId: winningPool.pool.id,
		});
		return {
			data: {
				available: true,
				pool: {
					id: winningPool.pool.id,
					name: winningPool.pool.name,
					usedShare: usedShareOf(ledger),
					periodEndsAt: period.endsAt,
				},
			},
		};
	});

export const quotaRouter = {
	status: quotaStatus,
};
