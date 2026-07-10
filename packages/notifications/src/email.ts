import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { createTransport, type Transporter } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { EmailConfigService } from "./config";
import { EmailError } from "./errors";

export type SendEmailParams = Readonly<{
	to: string;
	subject: string;
	text: string;
	html: string;
	from?: string;
}>;

export class EmailService extends Context.Service<
	EmailService,
	{
		readonly send: (params: SendEmailParams) => Effect.Effect<
			{
				messageId?: string;
			},
			EmailError
		>;
	}
>()("EmailService") {}

export const EmailLive = Layer.effect(
	EmailService,
	Effect.acquireRelease(
		Effect.gen(function* () {
			const { config } = yield* EmailConfigService;
			if (config.mode === "log_only") {
				yield* Effect.logInfo("Email service started in log-only mode");
				return {
					transport: null as Transporter | null,
					send: (params: SendEmailParams) =>
						Effect.logInfo({
							operation: "email.log-only",
							warning:
								"SENSITIVE LOG-ONLY EMAIL CONTENT: may contain authentication or invitation links",
							to: params.to,
							subject: params.subject,
							text: params.text,
							html: params.html,
						}).pipe(Effect.as({})),
				};
			}

			const options: SMTPTransport.Options = {
				host: config.host,
				port: config.port,
				secure: config.secure,
				tls: {
					rejectUnauthorized: config.tlsRejectUnauthorized,
				},
				connectionTimeout: 30_000,
				greetingTimeout: 30_000,
				socketTimeout: 120_000,
				auth: config.auth
					? {
							user: config.auth.username,
							pass: Redacted.value(config.auth.password),
						}
					: undefined,
			};
			const transport = createTransport(options);
			yield* Effect.forkScoped(
				Effect.tryPromise({
					try: () => transport.verify(),
					catch: (cause) =>
						new EmailError({
							operation: "verifyTransport",
							cause,
						}),
				}).pipe(
					Effect.tapError((error) =>
						Effect.logError({
							operation: "email.smtp-verification.failed",
							host: config.host,
							port: config.port,
							cause: String(error.cause),
						}),
					),
					Effect.ignore,
				),
			);
			const defaultFrom = `${config.fromName} <${config.from}>`;
			return {
				transport,
				send: (params: SendEmailParams) =>
					Effect.tryPromise({
						try: async () => {
							const info = await transport.sendMail({
								...params,
								from: params.from ?? defaultFrom,
							});
							return {
								messageId: info.messageId || undefined,
							};
						},
						catch: (cause) =>
							new EmailError({
								operation: "send",
								cause,
							}),
					}),
			};
		}),
		({ transport }) =>
			transport ? Effect.sync(() => transport.close()) : Effect.void,
	).pipe(
		Effect.map(({ send }) => ({
			send,
		})),
	),
);
