import { createEnv } from "@t3-oss/env-core";
import { z } from "zod/v4";

export const serverEnv = createEnv({
	server: {
		BASE_URL: z.url(),
		TRIGGER_PROJECT: z.string(),
		POSTGRES_USER: z.string(),
		POSTGRES_PASSWORD: z.string(),
		POSTGRES_HOST: z.string(),
		POSTGRES_PORT: z.string().default("5432"),
		POSTGRES_DB: z.string(),
		QDRANT_URL: z.string(),
		QDRANT_API_KEY: z.string(),
		SPICEDB_ENDPOINT: z.string(),
		SPICEDB_TOKEN: z.string(),
		OPENAI_COMPATIBLE_BASE_URL: z.url(),
		OPENAI_COMPATIBLE_API_KEY: z.string(),
		S3_ACCESS_KEY: z.string(),
		S3_SECRET_KEY: z.string(),
		S3_REGION: z.string().default("eu-central-1"),
		S3_ENDPOINT: z.string(),
		LANGFUSE_BASEURL: z.url(),
		LANGFUSE_PUBLIC_KEY: z.string(),
		LANGFUSE_SECRET_KEY: z.string(),
		ENCRYPTION_KEY: z.string().min(32).max(64),
		SMTP_USERNAME: z.string(),
		SMTP_PASSWORD: z.string(),
		SMTP_PORT: z.coerce.number().default(587),
		SMTP_HOST: z.string(),
		OTEL_TRACES_EXPORTER: z.string().optional(),
		OTEL_EXPORTER_OTLP_PROTOCOL: z.string().default("http/protobuf"),
		OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: z.string().optional(),
		OTEL_NODE_RESOURCE_DETECTORS: z.string().default("env,host,os"),
		OTEL_SERVICE_NAME: z.string().default("sokratest-v2"),
		OTEL_EXPORTER_OTLP_HEADERS: z.string().optional(),
		NODE_ENV: z.string(),
	},

	/**
	 * What object holds the environment variables at runtime. This is usually
	 * `process.env` or `import.meta.env`.
	 */
	runtimeEnv: process.env,

	/**
	 * By default, this library will feed the environment variables directly to
	 * the Zod validator.
	 *
	 * This means that if you have an empty string for a value that is supposed
	 * to be a number (e.g. `PORT=` in a ".env" file), Zod will incorrectly flag
	 * it as a type mismatch violation. Additionally, if you have an empty string
	 * for a value that is supposed to be a string with a default value (e.g.
	 * `DOMAIN=` in an ".env" file), the default value will never be applied.
	 *
	 * In order to solve these issues, we recommend that all new projects
	 * explicitly specify this option as true.
	 */
	emptyStringAsUndefined: true,
});
