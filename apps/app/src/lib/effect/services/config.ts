import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";

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

const failConfig = (message: string, actual: unknown) =>
	Effect.fail(
		new Config.ConfigError(
			new Schema.SchemaError(
				new SchemaIssue.InvalidValue(Option.some(actual), {
					message,
				}),
			),
		),
	);

type EmailConfig =
	| {
			readonly mode: "log_only";
	  }
	| {
			readonly mode: "smtp";
			readonly host: string;
			readonly port: number;
			readonly secure: boolean;
			readonly tlsRejectUnauthorized: boolean;
			readonly from: string;
			readonly fromName: string;
			readonly auth:
				| {
						readonly username: string;
						readonly password: Redacted.Redacted<string>;
				  }
				| undefined;
	  };

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
	fromName: Config.withDefault(Config.string("SMTP_FROM_NAME"), "OrcAI Team"),
}).pipe(
	Config.mapOrFail((raw): Effect.Effect<EmailConfig, Config.ConfigError> => {
		const host = normalizeOptionalString(raw.host);
		const from = normalizeOptionalString(raw.from);
		const username = normalizeOptionalString(raw.username);
		const password = normalizeOptionalString(raw.password);
		const port = Option.match(normalizeOptionalString(raw.port), {
			onNone: () => 587,
			onSome: (resolved) => Number(resolved),
		});

		const hasHost = Option.isSome(host);
		const hasFrom = Option.isSome(from);
		const hasUsername = Option.isSome(username);
		const hasPassword = Option.isSome(password);

		if (!hasHost && !hasFrom && !hasUsername && !hasPassword) {
			return Effect.succeed({
				mode: "log_only" as const,
			});
		}

		if (!Number.isInteger(port) || port < 1 || port > 65535) {
			return failConfig(
				"Invalid SMTP_PORT value. Expected an integer between 1 and 65535.",
				raw.port,
			);
		}

		if (!hasHost || !hasFrom) {
			return failConfig(
				"Partial SMTP configuration detected. SMTP_HOST and SMTP_FROM must both be set to enable email sending.",
				raw,
			);
		}

		if (hasUsername !== hasPassword) {
			return failConfig(
				"Partial SMTP authentication configuration detected. SMTP_USERNAME and SMTP_PASSWORD must both be set or both be omitted.",
				raw,
			);
		}

		return Effect.succeed({
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
		});
	}),
);

const appConfig = Config.all({
	auth: Config.all({
		secret: Config.redacted("BETTER_AUTH_SECRET"),
		url: Config.string("BETTER_AUTH_URL"),
	}),
	email: emailConfig,
	app: Config.all({
		encryptionKey: Config.redacted("ENCRYPTION_KEY"),
	}),
});

type AppConfig = Config.Success<typeof appConfig>;

export class AppConfigService extends Context.Service<
	AppConfigService,
	{
		readonly config: AppConfig;
	}
>()("AppConfigService") {}

export const AppConfigLive = Layer.effect(
	AppConfigService,
	Effect.gen(function* () {
		const config = yield* appConfig;

		return {
			config,
		};
	}),
);

export const loadAppConfigSync = (): AppConfig =>
	Effect.runSync(
		Effect.gen(function* () {
			return yield* appConfig;
		}),
	);
