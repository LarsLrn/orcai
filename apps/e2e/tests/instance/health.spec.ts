import { WELL_KNOWN_ADMIN } from "../../fixtures/constants";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { open } from "../../fixtures/navigation";

test.describe.configure({
	mode: "serial",
});

const DEPENDENCIES = [
	"instance_health_check_postgres_title",
	"instance_health_check_spicedb_title",
	"instance_health_check_qdrant_title",
	"instance_health_check_s3_title",
	"instance_health_check_valkey_title",
];

test("instance: the instance area opens on health with every dependency reachable", async ({
	pageAsWellKnownAdmin,
}) => {
	const page = await pageAsWellKnownAdmin();
	await open(page, "/instance");
	await expect(page).toHaveURL(/\/instance\/health$/);
	await expect(
		page.getByRole("heading", {
			name: message("instance_health_page_title"),
		}),
	).toBeVisible();

	for (const title of DEPENDENCIES) {
		await expect(
			page.getByRole("listitem", {
				name: message(title),
			}),
		).toHaveAttribute("data-status", "ok");
	}

	// The app registers its pg-boss instance under its process name.
	const processes = page.getByRole("table").filter({
		has: page.getByRole("columnheader", {
			name: message("instance_health_process_heartbeat_header"),
		}),
	});
	await expect(
		processes.getByRole("cell", {
			name: "app",
			exact: true,
		}),
	).toBeVisible();

	for (const secret of [
		"postgres.password",
		"auth.secret",
	]) {
		await expect(
			page.getByRole("row", {
				name: secret,
			}),
		).toHaveText(
			new RegExp(`^${secret}${message("instance_health_config_secret_set")}$`),
		);
	}
});

test("instance: /api/health answers without session or detail", async ({
	appBaseURL,
	playwright,
}) => {
	const request = await playwright.request.newContext();
	const response = await request.get(`${appBaseURL}/api/health`);
	expect(response.status()).toBe(200);
	expect(await response.text()).toBe("");
	await request.dispose();
});

test("instance: a test email is queued for the signed-in admin only", async ({
	outbox,
	pageAsWellKnownAdmin,
}) => {
	const page = await pageAsWellKnownAdmin();
	await open(page, "/instance/health");
	const before = await outbox.latestFor(
		WELL_KNOWN_ADMIN.email,
		"instance.test-email",
	);

	await page
		.getByRole("button", {
			name: message("instance_health_test_email_button"),
		})
		.click();

	await expect
		.poll(
			async () =>
				(await outbox.latestFor(WELL_KNOWN_ADMIN.email, "instance.test-email"))
					?.id,
		)
		.not.toBe(before?.id);
	await expect(
		page.getByRole("row", {
			name: message("instance_health_test_email_label"),
		}),
	).toBeVisible();
});
