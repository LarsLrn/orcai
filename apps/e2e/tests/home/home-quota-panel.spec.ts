import { setUpChatModel } from "../../fixtures/chat/chat";
import { expect, test } from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";

test("home: the quota panel tells no pool from no active pool", async ({
	api,
	inference,
	orgs,
	pageAs,
}) => {
	const fresh = await orgs.create("E2E Home Quota");
	const adminApi = api.as("admin", fresh);
	// The initial tour's modal would cover the dashboard.
	await adminApi.user.setTourState({
		tourId: "initialTour",
		state: "completed",
	});

	const admin = await pageAs("admin", fresh);
	await enterApp(admin, fresh.slug);
	await open(admin, "/app/manage");
	await expect(
		admin.getByText(message("home_quota_panel_empty_note")),
	).toBeVisible();

	await setUpChatModel(
		{
			...api,
			as: (role) => api.as(role, fresh),
		},
		inference,
	);
	const { data: pools } = await adminApi.quota.list({
		pageIndex: 0,
		pageSize: 100,
	});
	for (const pool of pools) {
		await adminApi.quota.deactivate({
			id: pool.id,
		});
	}

	await admin.reload();
	await expect(
		admin.getByText(message("home_quota_panel_none_active_note")),
	).toBeVisible();
	await expect(
		admin.getByText(message("home_quota_panel_empty_note")),
	).toHaveCount(0);
});
