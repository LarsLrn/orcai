import { expect, test } from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { open } from "../../fixtures/navigation";

test("pipeline: the health page sees the workers and a test email delivered to the log", async ({
	pageAsWellKnownAdmin,
}) => {
	const page = await pageAsWellKnownAdmin();
	await open(page, "/instance/health");
	await expect(
		page.getByRole("listitem", {
			name: message("instance_health_check_workers_title"),
		}),
	).toHaveAttribute("data-status", "ok");

	await page
		.getByRole("button", {
			name: message("instance_health_test_email_button"),
		})
		.click();

	// Probes run on load and on demand only, so check again until the workers sent it.
	const testEmail = page.getByRole("row", {
		name: message("instance_health_test_email_label"),
	});
	const refresh = page.getByRole("button", {
		name: message("instance_health_refresh_button"),
	});
	await expect(async () => {
		await refresh.click();
		await expect(testEmail).toContainText(
			message("instance_health_test_email_status_sent"),
			{
				timeout: 2_000,
			},
		);
	}).toPass();
	await expect(testEmail).toContainText(
		message("instance_health_mail_channel_log"),
	);
	await expect(
		page.getByRole("listitem", {
			name: message("instance_health_check_mail_title"),
		}),
	).toContainText(message("check_reason_mail_log_only"));
});
