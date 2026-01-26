import { v1 } from "@authzed/authzed-node";
import { serverEnv } from "@/lib/env/server";
import { logger } from "@/lib/observability/logger";

const globalForSpice = globalThis as unknown as {
	__SPICEDB_CLIENT__?: ReturnType<typeof v1.NewClient>["promises"];
};

/**
 * Creates a SpiceDB client (schema should be deployed separately via build script)
 * @returns Promise that resolves to the SpiceDB client
 */
export const getSpiceClient = () => {
	// Reuse existing client if available (prevents multiple connections on HMR)
	if (globalForSpice.__SPICEDB_CLIENT__)
		return globalForSpice.__SPICEDB_CLIENT__;

	try {
		// Create SpiceDB client
		// TODO: Replace with actual SpiceDB server address and security settings
		const { promises: client } = v1.NewClient(
			serverEnv.SPICEDB_TOKEN,
			serverEnv.SPICEDB_ENDPOINT,
			v1.ClientSecurity.INSECURE_PLAINTEXT_CREDENTIALS,
		);

		globalForSpice.__SPICEDB_CLIENT__ = client;
		logger.info("SpiceDB client initialized successfully");

		return client;
	} catch (error) {
		globalForSpice.__SPICEDB_CLIENT__ = undefined;
		logger.error({ error }, "Error initializing SpiceDB client");
		throw error;
	}
};
