import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { reactStartCookies } from "better-auth/react-start";
import { createTransport } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/db/drizzle";
import { account, session, user, verification } from "@/db/schema/auth";

export const auth = betterAuth({
	telemetry: { enabled: false },
	trustedOrigins: [
		"http://localhost:3000",
		process.env.VITE_BASE_URL || "http://localhost:3000",
		"http://host.docker.internal:3000",
	],
	plugins: [reactStartCookies(), admin()],
	database: drizzleAdapter(db, {
		provider: "pg",
		schema: {
			user,
			account,
			session,
			verification,
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
	host: process.env.SMTP_HOST,
	port: Number(process.env.SMTP_PORT) || 587,
	secure: false, // upgrade later with STARTTLS
	tls: { rejectUnauthorized: false },
	auth: {
		user: process.env.SMTP_USERNAME,
		pass: process.env.SMTP_PASSWORD,
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
		console.log("Email sent successfully");
	} catch (error) {
		console.error("Error sending email:", error);
	}
}
