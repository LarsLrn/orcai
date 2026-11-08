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

/** A blank value means the setting is not configured. */
const optionalSetting = (name: string) =>
	Config.option(Config.String(name)).pipe(
		Config.map(
			Option.flatMap((value) => {
				const trimmed = value.trim();
				return trimmed.length > 0 ? Option.some(trimmed) : Option.none();
			}),
		),
	);

const invalid = (message: string) =>
	Effect.fail(
		new Config.ConfigError(
			new Schema.SchemaError(
				new SchemaIssue.InvalidValue({
					message,
				}),
			),
		),
	);

const emailConfig = Config.all({
	host: optionalSetting("SMTP_HOST"),
	port: Config.option(Config.String("SMTP_PORT")),
	username: optionalSetting("SMTP_USERNAME"),
	password: optionalSetting("SMTP_PASSWORD"),
	secure: Config.option(Config.Boolean("SMTP_SECURE")),
	tlsRejectUnauthorized: Config.withDefault(
		Config.Boolean("SMTP_TLS_REJECT_UNAUTHORIZED"),
		true,
	),
	from: optionalSetting("SMTP_FROM"),
	fromName: Config.withDefault(Config.String("SMTP_FROM_NAME"), "OrcAI Team"),
}).pipe(
	Config.mapEffect(
		({
			host,
			from,
			username,
			password,
			port,
			secure,
			...smtp
		}): Effect.Effect<EmailConfig, Config.ConfigError> => {
			if (
				[
					host,
					from,
					username,
					password,
				].every(Option.isNone)
			)
				return Effect.succeed({
					mode: "log_only",
				});
			if (Option.isNone(host) || Option.isNone(from))
				return invalid("SMTP_HOST and SMTP_FROM must both be configured");
			if (Option.isSome(username) !== Option.isSome(password))
				return invalid(
					"SMTP_USERNAME and SMTP_PASSWORD must both be configured",
				);
			const smtpPort = Option.match(port, {
				onNone: () => 587,
				onSome: Number,
			});
			if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535)
				return invalid("SMTP_PORT must be between 1 and 65535");
			return Effect.succeed({
				mode: "smtp",
				...smtp,
				host: host.value,
				from: from.value,
				port: smtpPort,
				secure: Option.getOrElse(secure, () => smtpPort === 465),
				auth:
					Option.isSome(username) && Option.isSome(password)
						? {
								username: username.value,
								password: Redacted.make(password.value),
							}
						: undefined,
			});
		},
	),
);

export class EmailConfigService extends Context.Service<
	EmailConfigService,
	{
		readonly config: EmailConfig;
	}
>()("EmailConfigService") {}

export const EmailConfigLive = Layer.effect(
	EmailConfigService,
	Effect.map(emailConfig, (config) => ({
		config,
	})),
);
