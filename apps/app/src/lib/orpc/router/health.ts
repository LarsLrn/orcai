import { enqueueNotification } from "@orcai/notifications";
import { localeSchema } from "@orcai/schema";
import { AppConfigService } from "@/lib/effect/services/config";
import { instanceHealth } from "@/lib/health/health";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireInstanceAdminMiddleware } from "@/lib/orpc/middlewares/auth";

const TEST_EMAIL_WINDOW_MS = 60_000;

const instance = authed.health.instance
	.use(requireInstanceAdminMiddleware)
	.effect(function* ({ context }) {
		return {
			data: yield* instanceHealth(context.auth.user),
		};
	});

const sendTestEmail = authed.health.sendTestEmail
	.use(requireInstanceAdminMiddleware)
	.effect(function* ({ context }) {
		const { config } = yield* AppConfigService;
		const { user } = context.auth;
		const queued = yield* enqueueNotification(
			{
				type: "instance.test-email",
				recipient: user.email,
				recipientName: user.name,
				locale: localeSchema.catch("en").parse(user.locale),
				healthUrl: `${config.auth.url}/instance/health`,
			},
			// One per admin per minute, however often or concurrently they ask.
			`instance.test-email:${user.id}:${Math.floor(Date.now() / TEST_EMAIL_WINDOW_MS)}`,
		);

		return {
			queued,
		};
	});

export const healthRouter = {
	instance,
	sendTestEmail,
};
