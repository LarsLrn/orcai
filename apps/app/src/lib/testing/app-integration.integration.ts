import { expect, test } from "bun:test";
import type { BlockId } from "@orcai/core";
import { createUser } from "@orcai/testing";
import { enqueueRelationshipMutations } from "@/lib/effect/services/authz";
import { appIntegration, TIMEOUT } from "@/lib/testing/app-integration";

const { run, outboxDelivered, readTuples } = appIntegration();

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
