import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";

const getOrThrow = <A>(name: string, value: Option.Option<A>): A =>
	Option.match(value, {
		onNone: () => {
			throw new Error(`Missing required SMTP configuration: ${name}`);
		},
		onSome: (resolved) => resolved,
	});

const normalizeOptionalString = (
	value: Option.Option<string>,
): Option.Option<string> =>
	Option.match(value, {
		onNone: () => Option.none(),
		onSome: (resolved) => {
			const trimmed = resolved.trim();
			return trimmed.length === 0 ? Option.none() : Option.some(trimmed);
		},
	});

const parseOptionalPort = (
	value: Option.Option<string>,
	defaultPort: number,
): number =>
	Option.match(normalizeOptionalString(value), {
		onNone: () => defaultPort,
		onSome: (resolved) => {
			const port = Number(resolved);
			if (!Number.isInteger(port) || port < 1 || port > 65535) {
				throw new Error(
					`Invalid SMTP_PORT value "${resolved}". Expected an integer between 1 and 65535.`,
				);
			}
			return port;
		},
	});

const emailConfig = Config.all({
	host: Config.option(Config.string("SMTP_HOST")),
	port: Config.option(Config.string("SMTP_PORT")),
	username: Config.option(Config.string("SMTP_USERNAME")),
	password: Config.option(Config.string("SMTP_PASSWORD")),
	secure: Config.withDefault(Config.boolean("SMTP_SECURE"), true),
	tlsRejectUnauthorized: Config.withDefault(
		Config.boolean("SMTP_TLS_REJECT_UNAUTHORIZED"),
		true,
	),
	from: Config.option(Config.string("SMTP_FROM")),
	fromName: Config.withDefault(
		Config.string("SMTP_FROM_NAME"),
		"Sokratest Team",
	),
}).pipe(
	Config.mapAttempt((raw) => {
		const host = normalizeOptionalString(raw.host);
		const from = normalizeOptionalString(raw.from);
		const username = normalizeOptionalString(raw.username);
		const password = normalizeOptionalString(raw.password);
		const port = parseOptionalPort(raw.port, 587);

		const hasHost = Option.isSome(host);
		const hasFrom = Option.isSome(from);
		const hasUsername = Option.isSome(username);
		const hasPassword = Option.isSome(password);

		if (!hasHost && !hasFrom && !hasUsername && !hasPassword) {
			return {
				mode: "log_only" as const,
			};
		}

		if (!hasHost || !hasFrom) {
			throw new Error(
				"Partial SMTP configuration detected. SMTP_HOST and SMTP_FROM must both be set to enable email sending.",
			);
		}

		if (hasUsername !== hasPassword) {
			throw new Error(
				"Partial SMTP authentication configuration detected. SMTP_USERNAME and SMTP_PASSWORD must both be set or both be omitted.",
			);
		}

		return {
			mode: "smtp" as const,
			host: getOrThrow("SMTP_HOST", host),
			port,
			secure: raw.secure,
			tlsRejectUnauthorized: raw.tlsRejectUnauthorized,
			from: getOrThrow("SMTP_FROM", from),
			fromName: raw.fromName,
			auth:
				hasUsername && hasPassword
					? {
							username: getOrThrow("SMTP_USERNAME", username),
							password: Redacted.make(getOrThrow("SMTP_PASSWORD", password)),
						}
					: undefined,
		};
	}),
);

const s3Config = Config.all({
	region: Config.withDefault(Config.string("S3_REGION"), "eu-central-1"),
	endpoint: Config.string("S3_ENDPOINT"),
	publicEndpoint: Config.option(Config.string("S3_PUBLIC_ENDPOINT")),
	accessKey: Config.redacted("S3_ACCESS_KEY"),
	secretKey: Config.redacted("S3_SECRET_KEY"),
}).pipe(
	Config.map((raw) => ({
		...raw,
		publicEndpoint: normalizeOptionalString(raw.publicEndpoint),
	})),
);

const appConfig = Config.all({
	postgres: Config.all({
		user: Config.string("POSTGRES_USER"),
		password: Config.redacted("POSTGRES_PASSWORD"),
		host: Config.string("POSTGRES_HOST"),
		port: Config.withDefault(Config.port("POSTGRES_PORT"), 5432),
		db: Config.string("POSTGRES_DB"),
	}),
	s3: s3Config,
	spice: Config.all({
		endpoint: Config.string("SPICEDB_ENDPOINT"),
		token: Config.redacted("SPICEDB_TOKEN"),
	}),
	ai: Config.all({
		baseUrl: Config.string("OPENAI_COMPATIBLE_BASE_URL"),
		apiKey: Config.redacted("OPENAI_COMPATIBLE_API_KEY"),
		doclingUrl: Config.string("DOCLING_URL"),
		doclingApiKey: Config.redacted("DOCLING_API_KEY"),
	}),
	auth: Config.all({
		secret: Config.redacted("BETTER_AUTH_SECRET"),
		url: Config.string("BETTER_AUTH_URL"),
	}),
	qdrant: Config.all({
		url: Config.string("QDRANT_URL"),
		apiKey: Config.redacted("QDRANT_API_KEY"),
		enableSparseVectors: Config.withDefault(
			Config.boolean("QDRANT_ENABLE_SPARSE_VECTORS"),
			false,
		),
	}),
	email: emailConfig,
	app: Config.all({
		encryptionKey: Config.redacted("ENCRYPTION_KEY"),
	}),
});

type AppConfig = Config.Config.Success<typeof appConfig>;

export class AppConfigService extends Context.Tag("AppConfigService")<
	AppConfigService,
	{
		readonly config: AppConfig;
	}
>() {}

export const AppConfigLive = Layer.effect(
	AppConfigService,
	appConfig.pipe(
		Effect.map((config) => ({
			config,
		})),
	),
);

export const loadAppConfigSync = (): AppConfig => Effect.runSync(appConfig);
