import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";

export type EmailConfig =
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
			readonly auth?: {
				readonly username: string;
				readonly password: Redacted.Redacted<string>;
			};
	  };

const config = Config.all({
	host: Config.option(Config.string("SMTP_HOST")),
	port: Config.option(Config.string("SMTP_PORT")),
	username: Config.option(Config.string("SMTP_USERNAME")),
	password: Config.option(Config.string("SMTP_PASSWORD")),
	secure: Config.option(Config.boolean("SMTP_SECURE")),
	tlsRejectUnauthorized: Config.withDefault(
		Config.boolean("SMTP_TLS_REJECT_UNAUTHORIZED"),
		true,
	),
	from: Config.option(Config.string("SMTP_FROM")),
	fromName: Config.withDefault(Config.string("SMTP_FROM_NAME"), "OrcAI Team"),
}).pipe(
	Config.mapOrFail((raw): Effect.Effect<EmailConfig, Config.ConfigError> => {
		const normalize = (value: Option.Option<string>) =>
			Option.flatMap(value, (item) => {
				const trimmed = item.trim();
				return trimmed.length > 0 ? Option.some(trimmed) : Option.none();
			});
		const host = normalize(raw.host);
		const from = normalize(raw.from);
		const username = normalize(raw.username);
		const password = normalize(raw.password);
		const hasAny = [
			host,
			from,
			username,
			password,
		].some(Option.isSome);
		if (!hasAny)
			return Effect.succeed({
				mode: "log_only",
			} as const);
		const port = Option.match(raw.port, {
			onNone: () => 587,
			onSome: Number,
		});
		const invalid = (message: string, actual: unknown) =>
			Effect.fail(
				new Config.ConfigError(
					new Schema.SchemaError(
						new SchemaIssue.InvalidValue(Option.some(actual), {
							message,
						}),
					),
				),
			);
		if (Option.isNone(host) || Option.isNone(from)) {
			return invalid("SMTP_HOST and SMTP_FROM must both be configured", raw);
		}
		if (Option.isSome(username) !== Option.isSome(password)) {
			return invalid(
				"SMTP_USERNAME and SMTP_PASSWORD must both be configured",
				raw,
			);
		}
		if (!Number.isInteger(port) || port < 1 || port > 65535) {
			return invalid("SMTP_PORT must be between 1 and 65535", raw.port);
		}
		const secure = Option.getOrElse(raw.secure, () => port === 465);
		return Effect.succeed({
			mode: "smtp" as const,
			host: host.value,
			port,
			secure,
			tlsRejectUnauthorized: raw.tlsRejectUnauthorized,
			from: from.value,
			fromName: raw.fromName,
			auth:
				Option.isSome(username) && Option.isSome(password)
					? {
							username: username.value,
							password: Redacted.make(password.value),
						}
					: undefined,
		});
	}),
);

export class EmailConfigService extends Context.Service<
	EmailConfigService,
	{
		readonly config: EmailConfig;
	}
>()("EmailConfigService") {}

export const EmailConfigLive = Layer.effect(
	EmailConfigService,
	Effect.map(config, (resolved) => ({
		config: resolved,
	})),
);
