import { PgBoss } from "pg-boss";
import { pgConnectionString } from "@/settings/db";

const globalForPgBoss = globalThis as unknown as {
	__PG_BOSS_PROMISE__?: Promise<PgBoss>;
	__PG_BOSS_SHUTDOWN_REGISTERED__?: boolean;
};

/**
 * Get the singleton PgBoss instance.
 * In development, utilizes a global variable to persist the connection across HMR reloads.
 */
export function getPgBoss(): Promise<PgBoss> {
	if (globalForPgBoss.__PG_BOSS_PROMISE__)
		return globalForPgBoss.__PG_BOSS_PROMISE__;

	globalForPgBoss.__PG_BOSS_PROMISE__ = initPgBoss();
	return globalForPgBoss.__PG_BOSS_PROMISE__;
}

async function initPgBoss(): Promise<PgBoss> {
	const boss = new PgBoss({ connectionString: pgConnectionString });

	try {
		await boss.start();
		console.log("pg-boss client started successfully");

		registerProcessCleanup();
		return boss;
	} catch (err) {
		globalForPgBoss.__PG_BOSS_PROMISE__ = undefined;
		console.error("Failed to start pg-boss:", err);
		throw err;
	}
}

function registerProcessCleanup() {
	if (globalForPgBoss.__PG_BOSS_SHUTDOWN_REGISTERED__) return;
	globalForPgBoss.__PG_BOSS_SHUTDOWN_REGISTERED__ = true;

	process.once("SIGTERM", shutdownPgBoss);
	process.once("SIGINT", shutdownPgBoss);
}

export async function shutdownPgBoss() {
	const promise = globalForPgBoss.__PG_BOSS_PROMISE__;
	if (!promise) return;

	// Clear the global promise so no new callers get the shutting-down instance
	globalForPgBoss.__PG_BOSS_PROMISE__ = undefined;

	try {
		const boss = await promise;
		console.log("Stopping pg-boss client...");
		await boss.stop({ timeout: 5000, graceful: true });
		console.log("pg-boss client stopped successfully");
	} catch (err) {
		console.error("Error stopping pg-boss:", err);
	}
}
