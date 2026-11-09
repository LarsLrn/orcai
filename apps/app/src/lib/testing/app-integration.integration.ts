import { expect, test } from "bun:test";
import type { BlockId } from "@orcai/core";
import { createUser } from "@orcai/testing";
import * as Effect from "effect/Effect";
import { enqueueRelationshipMutations } from "@/lib/effect/services/authz";
import { appIntegration, TIMEOUT } from "@/lib/testing/app-integration";

const { run, outboxDelivered, readTuples, caller, organizationWith } =
	appIntegration();

// The state an inline delivery leaves when it gives up. Holding the delivery
// lock to cause that would stall every file's deliveries in the parallel tier.
test(
	"outboxDelivered delivers events no inline delivery finished",
	async () => {
		const subject = await run(createUser());
		const blockId = crypto.randomUUID() as BlockId;
		await run(
			enqueueRelationshipMutations([
				{
					resourceType: "block",
					resourceId: blockId,
					relation: "viewer",
					subjectType: "user",
					subjectId: subject.id,
					operation: "touch",
				},
			]),
		);

		await outboxDelivered(subject.id);
		expect(
			await readTuples({
				resourceType: "block",
				resourceId: blockId,
			}),
		).toEqual([
			`viewer@user:${subject.id}`,
		]);
	},
	TIMEOUT,
);

test(
	"caller keeps SpiceDB's head revision for each write, whatever order calls return in",
	async () => {
		const {
			actors: [admin],
		} = await organizationWith([
			"admin",
		]);
		const { call, token } = caller();
		const returning = (zedToken: string, after?: Promise<void>) =>
			Effect.promise(async () => {
				await after;
				return {
					meta: {
						zedToken,
					},
				};
			});
		const late = Promise.withResolvers<void>();

		const earlier = call(admin, () => returning("earlier", late.promise));
		await call(admin, () => returning("later"));
		late.resolve();
		await earlier;

		expect([
			undefined,
			"earlier",
			"later",
		]).not.toContain(token());
	},
	TIMEOUT,
);
