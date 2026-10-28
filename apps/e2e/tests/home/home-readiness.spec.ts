import type { Page } from "@playwright/test";
import {
	createMockModel,
	openAssistantModelPicker,
	pickModel,
} from "../../fixtures/assistant/assistant";
import { setUpChatModel } from "../../fixtures/chat/chat";
import { submitForm } from "../../fixtures/forms";
import { expect, test } from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";

const checkItem = (page: Page, title: string) =>
	page.getByRole("listitem", {
		name: message(title),
	});

const failingBadge = (page: Page, count: number) =>
	page.getByLabel(
		message("home_manage_tab_failing_badge_label", {
			count,
		}),
	);

test("home: a fresh organisation's admin works through the setup checklist on Manage", async ({
	api,
	inference,
	orgs,
	pageAs,
}) => {
	test.slow();
	const fresh = await orgs.create("E2E Readiness");
	const adminApi = api.as("admin", fresh);
	// The initial tour's modal would cover Use once the admin gets there.
	await adminApi.user.setTourState({
		tourId: "initialTour",
		state: "completed",
	});

	const admin = await pageAs("admin", fresh);
	await enterApp(admin, fresh.slug);
	await open(admin, "/app");
	await expect(admin).toHaveURL(/\/app\/manage$/);
	await expect(failingBadge(admin, 5)).toBeVisible();
	await expect(
		checkItem(admin, "readiness_check_provider_title"),
	).toHaveAttribute("data-status", "failing");

	// Members keep the Use page and never see the checklist.
	const member = await pageAs("member", fresh);
	await enterApp(member, fresh.slug);
	await open(member, "/app");
	await expect(member).toHaveURL(/\/app\/?$/);
	await open(member, "/app/manage");
	await expect(member.getByText(message("readiness_card_title"))).toHaveCount(
		0,
	);

	const chat = await setUpChatModel(
		{
			...api,
			as: (role) => api.as(role, fresh),
		},
		inference,
	);
	const assistantModel = await createMockModel(adminApi, chat.providerId);
	await admin.reload();
	// The assistant model and its quota remain.
	await expect(failingBadge(admin, 2)).toBeVisible();

	await checkItem(admin, "readiness_check_assistant_model_title")
		.getByRole("link", {
			name: message("readiness_fix_action"),
		})
		.click();
	await expect(admin).toHaveURL(/\/app\/organization$/);
	const { data: provider } = await adminApi.provider.find({
		id: chat.providerId,
	});
	await openAssistantModelPicker(admin, provider.name, assistantModel.name);
	await submitForm(admin, {
		fill: () => pickModel(admin, assistantModel.name),
		submit: message("orgs_form_submit_button"),
		until: /\/app\/organization$/,
	});

	// Back home without a reload: the edit made readiness stale, so Use opens.
	await admin
		.getByRole("link", {
			name: message("header_home_link_label"),
			exact: true,
		})
		.click();
	await expect(admin).toHaveURL(/\/app\/?$/);
	// Without a badge the tab's name is its label alone.
	const manageTab = admin.getByRole("tab", {
		name: message("home_view_manage_tab"),
		exact: true,
	});
	await expect(manageTab).toBeVisible();
	await manageTab.click();
	await expect(
		checkItem(admin, "readiness_check_assistant_pool_title"),
	).toHaveAttribute("data-status", "ok");
});
