import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { createTransport, type Transporter } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { EmailError } from "@/lib/effect/utils/errors";
import { AppConfigService } from "./config";

export type SendEmailParams = Readonly<{
	to: string;
	subject: string;
	text?: string;
	html?: string;
	from?: string;
}>;

export class EmailService extends Context.Tag("EmailService")<
	EmailService,
	{
		readonly send: (params: SendEmailParams) => Effect.Effect<void, EmailError>;
	}
>() {}

const validatePayload = (params: SendEmailParams) => {
	if (!params.text && !params.html) {
		return Effect.fail(
			new EmailError({
				operation: "send",
				cause: new Error(
					"Email payload must include at least one of text or html.",
				),
			}),
		);
	}

	return Effect.void;
};

const logOnlyService = {
	send: (params: SendEmailParams) =>
		Effect.gen(function* () {
			yield* validatePayload(params);

			yield* Effect.logInfo({
				operation: "email.log-only",
				from: params.from ?? "log-only@orcai.local",
				to: params.to,
				subject: params.subject,
				text: params.text,
				html: params.html,
			});
		}),
} as const;

export const EmailLive = Layer.scoped(
	EmailService,
	Effect.acquireRelease(
		Effect.gen(function* () {
			const { config } = yield* AppConfigService;

			if (config.email.mode === "log_only") {
				yield* Effect.logInfo(
					"Email service started in log-only mode (SMTP not configured).",
				);

				return {
					transport: null as Transporter | null,
					service: logOnlyService,
				};
			}

			const fromHeader = `${config.email.fromName} <${config.email.from}>`;
			const smtpConfig: SMTPTransport.Options = {
				host: config.email.host,
				port: config.email.port,
				secure: config.email.secure,
				tls: {
					rejectUnauthorized: config.email.tlsRejectUnauthorized,
				},
			};

			if (config.email.auth) {
				smtpConfig.auth = {
					user: config.email.auth.username,
					pass: Redacted.value(config.email.auth.password),
				};
			}

			const transport = yield* Effect.try({
				try: () => createTransport(smtpConfig),
				catch: (error) =>
					new EmailError({
						operation: "createTransport",
						cause: error,
					}),
			});

			yield* Effect.tryPromise({
				try: () => transport.verify(),
				catch: (error) =>
					new EmailError({
						operation: "verifyTransport",
						cause: error,
					}),
			});

			yield* Effect.logInfo("Email service started successfully");

			return {
				transport,
				service: {
					send: (params: SendEmailParams) =>
						Effect.tryPromise({
							try: async () => {
								if (!params.text && !params.html) {
									throw new Error(
										"Email payload must include at least one of text or html.",
									);
								}

								await transport.sendMail({
									from: params.from ?? fromHeader,
									to: params.to,
									subject: params.subject,
									text: params.text,
									html: params.html,
								});
							},
							catch: (error) =>
								new EmailError({
									operation: "send",
									cause: error,
								}),
						}),
				},
			};
		}),
		({ transport }) =>
			transport === null
				? Effect.void
				: Effect.try({
						try: () => transport.close(),
						catch: (error) =>
							new EmailError({
								operation: "closeTransport",
								cause: error,
							}),
					}).pipe(
						Effect.catchAll((error) =>
							Effect.logError(`Failed to close SMTP transport: ${error}`),
						),
					),
	).pipe(Effect.map(({ service }) => service)),
);
