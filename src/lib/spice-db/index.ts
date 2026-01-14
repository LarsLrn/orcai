import { v1 } from "@authzed/authzed-node";
import { serverEnv } from "@/lib/env/server";

/**
 * Creates a SpiceDB client (schema should be deployed separately via build script)
 * @returns Promise that resolves to the SpiceDB client
 */
export const getSpiceClient = () => {
	try {
		// Create SpiceDB client
		// TODO: Replace with actual SpiceDB server address and security settings
		const { promises: client } = v1.NewClient(
			serverEnv.SPICEDB_TOKEN,
			serverEnv.SPICEDB_ENDPOINT,
			v1.ClientSecurity.INSECURE_PLAINTEXT_CREDENTIALS,
		);

		console.log("SpiceDB client initialized successfully");

		return client;
	} catch (error) {
		console.error("Error initializing SpiceDB client:", error);
		throw error;
	}
};
