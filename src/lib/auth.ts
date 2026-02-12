import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { createTransport } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/db/drizzle";
import { dbSchema } from "@/db/schema";
import { loadAppConfigSync } from "./effect/services/config";
import { logger } from "./observability/logger";

const cfg = loadAppConfigSync();

export const auth = betterAuth({
	baseURL: cfg.auth.url,
	secret: cfg.auth.secret,
	telemetry: { enabled: false },
	trustedOrigins: [
		cfg.auth.url,
		"http://localhost:3000",
		"http://host.docker.internal:3000",
		"sokratest://",
		"http://10.0.2.2:3000",
	],
	// tanstackStartCookies plugin must be last in the array
	plugins: [admin(), expo(), tanstackStartCookies()],
	database: drizzleAdapter(db, {
		provider: "pg",
		schema: {
			user: dbSchema.user,
			account: dbSchema.account,
			session: dbSchema.session,
			verification: dbSchema.verification,
		},
	}),
	emailAndPassword: {
		enabled: true,
		sendResetPassword: async ({ user, url }, _request) => {
			await sendEmail({
				to: user.email,
				subject: "Reset your password",
				text: `Click the link to reset your password: ${url}`,
			});
		},
	},
	emailVerification: {
		sendVerificationEmail: async ({ user, url }) => {
			await sendEmail({
				to: user.email,
				subject: "Verify your email address",
				text: `Click the link to verify your email: ${url}`,
			});
		},
	},
	advanced: {
		database: {
			generateId: () => uuidv4(),
		},
	},
	session: {
		additionalFields: {
			activeOrganizationId: {
				type: "string",
				required: false,
				input: true,
			},
		},
	},
});

const smtpConfig: SMTPTransport.Options = {
	host: cfg.mail.host,
	port: cfg.mail.port,
	secure: false, // upgrade later with STARTTLS
	tls: { rejectUnauthorized: false },
	auth: {
		user: cfg.mail.username,
		pass: cfg.mail.password,
	},
};

async function sendEmail({
	to,
	subject,
	text,
}: {
	to: string;
	subject: string;
	text: string;
}) {
	const transporter = createTransport(smtpConfig);

	const mailOptions = {
		from: "test@example.com",
		to,
		subject,
		text,
	};

	try {
		await transporter.sendMail(mailOptions);
		logger.info(`Email sent to ${to} with subject "${subject}"`);
	} catch (error) {
		logger.error(
			{ error },
			`Error sending email to ${to} with subject "${subject}"`,
		);
	}
}
