import type { PgBoss } from "@orcai/pg-boss";
import { jobQueues } from "@orcai/schema";

/** Creates every queue the workers create at boot; the tier runs no workers. */
export const createJobQueues = async (boss: PgBoss) => {
	for (const name of jobQueues.options) {
		await boss.createQueue(name);
	}
};
