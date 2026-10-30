import { describe, expect, test } from "bun:test";
import { emailActionSchema, LOCALES, resetPasswordSchema } from "@orcai/schema";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Logger from "effect/Logger";
import {
	EmailConfigLive,
	EmailConfigService,
	EmailLive,
	EmailService,
	emailNotificationSchema,
	notificationOutboxValues,
	renderEmail,
} from "../src";
import { m } from "../src/paraglide/messages";

const notifications = [
	{
		type: "organization.invited" as const,
		recipient: "INVITEE@example.com",
		recipientName: "<Invitee>",
		invitationId: "6ba7b810-9dad-41d1-80b4-00c04fd430c8",
		organizationName: "Research & Teaching",
		inviterName: "Ada",
		role: "member" as const,
		expiresAt: new Date("2026-08-01T00:00:00.000Z"),
		registrationUrl:
			"https://example.com/register?inv=6ba7b810-9dad-41d1-80b4-00c04fd430c8",
	},
	{
		type: "auth.verify-email" as const,
		recipient: "user@example.com",
		recipientName: "User",
		verificationUrl: "https://example.com/api/auth/verify-email?token=secret",
	},
	{
		type: "auth.reset-password" as const,
		recipient: "user@example.com",
		recipientName: "User",
		resetUrl: "https://example.com/reset-password?token=secret",
	},
	{
		type: "data-export.ready" as const,
		recipient: "user@example.com",
		recipientName: "User",
		accountUrl: "https://example.com/app/account",
		expiresAt: new Date("2026-08-01T12:00:00.000Z"),
	},
	{
		type: "auth.two-factor-disabled" as const,
		recipient: "user@example.com",
		recipientName: "User",
		securityUrl: "https://example.com/app/account/security",
	},
	{
		type: "auth.two-factor-reset" as const,
		recipient: "user@example.com",
		recipientName: "User",
		securityUrl: "https://example.com/app/account/security",
	},
	{
		type: "auth.instance-admin-granted" as const,
		recipient: "user@example.com",
		recipientName: "User",
		securityUrl: "https://example.com/app/account/security",
		twoFactorRequired: true,
	},
	{
		type: "auth.instance-admin-revoked" as const,
		recipient: "user@example.com",
		recipientName: "User",
		securityUrl: "https://example.com/app/account/security",
	},
	{
		type: "auth.passkey-added" as const,
		recipient: "user@example.com",
		recipientName: "User",
		securityUrl: "https://example.com/app/account/security",
	},
	{
		type: "instance.test-email" as const,
		recipient: "admin@example.com",
		recipientName: "Admin",
		healthUrl: "https://example.com/instance/health",
	},
];

const loadEmailConfig = (values: Record<string, unknown>) =>
	Effect.runPromise(
		EmailConfigService.pipe(
			Effect.provide(EmailConfigLive),
			Effect.provideService(
				ConfigProvider.ConfigProvider,
				ConfigProvider.fromUnknown(values),
			),
		),
	);

describe("notification schemas and templates", () => {
	test("validates shared auth email and password forms", () => {
		expect(
			emailActionSchema.parse({
				email: "user@example.com",
			}),
		).toEqual({
			email: "user@example.com",
		});
		expect(() =>
			emailActionSchema.parse({
				email: "invalid",
			}),
		).toThrow();
		expect(() =>
			resetPasswordSchema.parse({
				password: "password-one",
				confirmPassword: "password-two",
			}),
		).toThrow();
	});

	test("treats blank SMTP variables as log-only configuration", async () => {
		const service = await loadEmailConfig({
			SMTP_HOST: "",
			SMTP_FROM: "",
			SMTP_USERNAME: "",
			SMTP_PASSWORD: "",
		});
		expect(service.config).toEqual({
			mode: "log_only",
		});
	});

	test("logs complete sensitive email content in log-only mode", async () => {
		const entries: unknown[] = [];
		const logger = Logger.make(({ message }) =>
			entries.push(...(message as unknown[])),
		);
		const email = {
			to: "user@example.com",
			subject: "Reset your password",
			text: "Reset at https://example.com/reset?token=secret",
			html: '<a href="https://example.com/reset?token=secret">Reset</a>',
		};

		const result = await Effect.runPromise(
			Effect.gen(function* () {
				const service = yield* EmailService;
				return yield* service.send(email);
			}).pipe(
				Effect.provide(EmailLive),
				Effect.provide(EmailConfigLive),
				Effect.provideService(
					ConfigProvider.ConfigProvider,
					ConfigProvider.fromUnknown({
						SMTP_HOST: "",
						SMTP_FROM: "",
					}),
				),
				Effect.withLogger(logger),
			),
		);

		expect(result).toEqual({
			channel: "log",
		});
		expect(entries).toContainEqual({
			operation: "email.log-only",
			warning:
				"SENSITIVE LOG-ONLY EMAIL CONTENT: may contain authentication or invitation links",
			...email,
		});
	});

	test("defaults SMTP to STARTTLS on port 587", async () => {
		const service = await loadEmailConfig({
			SMTP_HOST: "smtp.example.com",
			SMTP_FROM: "mail@example.com",
		});
		expect(service.config).toMatchObject({
			mode: "smtp",
			port: 587,
			secure: false,
		});
	});

	test("supports explicit implicit TLS configuration", async () => {
		const service = await loadEmailConfig({
			SMTP_HOST: "smtp.example.com",
			SMTP_FROM: "mail@example.com",
			SMTP_PORT: "465",
			SMTP_SECURE: "true",
		});
		expect(service.config).toMatchObject({
			mode: "smtp",
			port: 465,
			secure: true,
		});
	});

	test("derives implicit TLS from port 465 when SMTP_SECURE is blank", async () => {
		const service = await Effect.runPromise(
			EmailConfigService.pipe(
				Effect.provide(EmailConfigLive),
				Effect.provideService(
					ConfigProvider.ConfigProvider,
					ConfigProvider.fromEnv({
						env: {
							SMTP_HOST: "smtp.example.com",
							SMTP_FROM: "mail@example.com",
							SMTP_PORT: "465",
							SMTP_SECURE: "",
						},
					}),
				),
			),
		);
		expect(service.config).toMatchObject({
			mode: "smtp",
			port: 465,
			secure: true,
		});
	});

	test("rejects partial SMTP configuration", async () => {
		await expect(
			loadEmailConfig({
				SMTP_HOST: "smtp.example.com",
			}),
		).rejects.toThrow();
	});

	for (const notification of notifications) {
		test(`renders ${notification.type} as HTML and plain text`, async () => {
			const parsed = emailNotificationSchema.parse(notification);
			const rendered = await renderEmail(parsed);

			expect(rendered.subject.length).toBeGreaterThan(0);
			expect(rendered.html).toContain("OrcAI");
			expect(rendered.text).toContain("OrcAI");
			const actionUrl =
				"registrationUrl" in notification
					? notification.registrationUrl
					: "verificationUrl" in notification
						? notification.verificationUrl
						: "resetUrl" in notification
							? notification.resetUrl
							: "securityUrl" in notification
								? notification.securityUrl
								: "healthUrl" in notification
									? notification.healthUrl
									: notification.accountUrl;

			if (!actionUrl) {
				throw new Error("Missing action URL");
			}
			expect(rendered.html).toContain(actionUrl.replaceAll("&", "&amp;"));
			expect(rendered.html).not.toContain("<Invitee>");
		});
	}

	test("renders payloads queued without a locale in English", async () => {
		const { locale: _, ...legacy } = emailNotificationSchema.parse(
			notifications[1],
		);
		const rendered = await renderEmail(emailNotificationSchema.parse(legacy));
		expect(rendered.html).toMatch(/<html[^>]* lang="en"/);
		expect(rendered.subject).toBe(
			m.email_verify_subject(
				{},
				{
					locale: "en",
				},
			),
		);
	});

	for (const locale of LOCALES) {
		const options = {
			locale,
		};

		test(`renders the verification email in ${locale}`, async () => {
			const rendered = await renderEmail(
				emailNotificationSchema.parse({
					...notifications[1],
					locale,
				}),
			);
			expect(rendered.html).toMatch(new RegExp(`<html[^>]* lang="${locale}"`));
			expect(rendered.subject).toBe(m.email_verify_subject({}, options));
			expect(rendered.text).toContain(m.email_verify_body({}, options));
			expect(rendered.text).toContain(m.email_verify_action({}, options));
		});

		test(`renders the password reset email in ${locale}`, async () => {
			const rendered = await renderEmail(
				emailNotificationSchema.parse({
					...notifications[2],
					locale,
				}),
			);
			expect(rendered.html).toMatch(new RegExp(`<html[^>]* lang="${locale}"`));
			expect(rendered.subject).toBe(
				m.email_reset_password_subject({}, options),
			);
			expect(rendered.text).toContain(m.email_reset_password_body({}, options));
		});

		test(`renders the invitation email in ${locale}`, async () => {
			const rendered = await renderEmail(
				emailNotificationSchema.parse({
					...notifications[0],
					locale,
				}),
			);
			expect(rendered.html).toMatch(new RegExp(`<html[^>]* lang="${locale}"`));
			expect(rendered.subject).toBe(
				m.email_organization_invited_subject(
					{
						organization: "Research & Teaching",
					},
					options,
				),
			);
			expect(rendered.text).toContain(
				m.email_organization_invited_body(
					{
						inviter: "Ada",
						organization: "Research & Teaching",
						role: m.email_organization_invited_role_member({}, options),
						date: locale === "de" ? "1. August 2026" : "1 August 2026",
					},
					options,
				),
			);
		});

		test(`renders the data export email in ${locale}`, async () => {
			const rendered = await renderEmail(
				emailNotificationSchema.parse({
					...notifications[3],
					locale,
				}),
			);
			expect(rendered.html).toMatch(new RegExp(`<html[^>]* lang="${locale}"`));
			expect(rendered.subject).toBe(
				m.email_data_export_ready_subject({}, options),
			);
			expect(rendered.text).toContain(
				m.email_data_export_ready_body(
					{
						date:
							locale === "de"
								? "1. August 2026 um 12:00 UTC"
								: "1 August 2026 at 12:00 UTC",
					},
					options,
				),
			);
		});
	}

	test("normalizes recipients and preserves a stable deduplication key", () => {
		const row = notificationOutboxValues(
			emailNotificationSchema.parse(notifications[0]),
			"organization.invited:stable",
		);
		expect(row.recipient).toBe("invitee@example.com");
		expect(row.deduplicationKey).toBe("organization.invited:stable");
		expect(row.payloadVersion).toBe(1);
	});

	test("rejects malformed action URLs", () => {
		expect(() =>
			emailNotificationSchema.parse({
				...notifications[1],
				verificationUrl: "javascript:alert(1)",
			}),
		).toThrow();
	});
});
