import { modelIdSchema, quotaPoolIdSchema } from "@orcai/schema";
import type { Locator, Page } from "@playwright/test";
import { untilAllowed } from "../../fixtures/authorization";
import { type Api, expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";
import { runId } from "../../fixtures/organisation";

const formsName = (label: string) => `E2E Forms ${label} ${runId()}`;

const createProvider = async (api: Api) => {
	const name = formsName("Provider");
	await untilAllowed(() =>
		api.as("admin").provider.create({
			name,
			description: "",
			endpoint: "http://127.0.0.1:9/v1",
			kind: "openai-compatible",
			meteringMode: "tokens",
			apiKey: "e2e-key",
			enabled: true,
		}),
	);
	return name;
};

const pickProvider = async (page: Page, name: string) => {
	await page
		.getByRole("combobox", {
			name: message("common_provider_label"),
		})
		.click();
	await page
		.getByRole("option", {
			name,
		})
		.click();
};

type Scrollable = {
	scrollTop: number;
	scrollHeight: number;
	clientHeight: number;
};

/** The popup keeps still while its list scrolls to the last option. */
const expectListScrollsInside = async (page: Page, popup: Locator) => {
	const list = popup.getByRole("listbox");
	await expect
		.poll(() =>
			list.evaluate((node) => {
				const scrollable = node as unknown as Scrollable;
				return scrollable.scrollHeight > scrollable.clientHeight;
			}),
		)
		.toBe(true);
	await list.hover();
	await page.mouse.wheel(0, 5000);
	const last = list.getByRole("option").last();
	await expect
		.poll(async () => {
			const [listBox, lastBox] = await Promise.all([
				list.boundingBox(),
				last.boundingBox(),
			]);
			return (
				listBox !== null &&
				lastBox !== null &&
				lastBox.y + lastBox.height <= listBox.y + listBox.height + 1
			);
		})
		.toBe(true);
	expect(
		await popup.evaluate((node) => (node as unknown as Scrollable).scrollTop),
	).toBe(0);
};

const removeButton = (scope: Locator | Page, label: string) =>
	scope.getByRole("button", {
		name: message("multi_select_remove_option_label", {
			label,
		}),
	});

test("forms: capabilities are picked from a filtered list and removed again", async ({
	api,
	org,
	pageAs,
}) => {
	const providerName = await createProvider(api);
	const page = await pageAs("admin");
	await enterApp(page, org.slug);
	await open(page, "/app/models/add");

	await pickProvider(page, providerName);
	const name = formsName("Model");
	await page.getByLabel(message("common_name_label")).fill(name);
	await page
		.getByLabel(message("models_form_provider_model_id_label"))
		.fill(`e2e-${runId()}`);

	const input = page.getByRole("combobox", {
		name: message("models_form_capabilities_label"),
	});
	const listbox = page.getByRole("listbox");
	const text = message("models_capability_text_label");
	const toolCalling = message("models_capability_tool_calling_label");
	const reasoning = message("models_capability_reasoning_label");

	// The chevron opens the list; picking keeps it open for the next pick.
	await page
		.getByRole("button", {
			name: message("multi_select_show_options"),
		})
		.click();
	await listbox
		.getByRole("option", {
			name: text,
		})
		.click();
	await listbox
		.getByRole("option", {
			name: toolCalling,
		})
		.click();
	await expect(
		listbox.getByRole("option", {
			name: text,
		}),
	).toHaveAttribute("aria-selected", "true");
	await page.keyboard.press("Escape");
	await expect(listbox).toBeHidden();
	await expect(removeButton(page, text)).toBeVisible();
	await expect(removeButton(page, toolCalling)).toBeVisible();

	// Typing filters; arrows and Enter pick from the keyboard.
	await input.fill("reas");
	await expect(listbox.getByRole("option")).toHaveCount(1);
	await input.press("ArrowDown");
	await input.press("Enter");
	await expect(removeButton(page, reasoning)).toBeVisible();

	// Enter on a chosen item deselects it, and selects it again.
	const reasoningOption = listbox.getByRole("option", {
		name: reasoning,
	});
	await input.press("Enter");
	await expect(reasoningOption).toHaveAttribute("aria-selected", "false");
	await input.press("Enter");
	await expect(reasoningOption).toHaveAttribute("aria-selected", "true");

	await input.fill("nothing like this");
	await expect(
		page.getByText(message("multi_select_empty_state")),
	).toBeVisible();
	await input.fill("");

	// Backspace in the empty input removes the last pill, the cross any pill.
	await input.press("Backspace");
	await expect(removeButton(page, reasoning)).toHaveCount(0);
	await input.press("Escape");
	await removeButton(page, text).click();
	await expect(removeButton(page, text)).toHaveCount(0);
	await expect(removeButton(page, toolCalling)).toBeVisible();

	await page
		.getByRole("button", {
			name: message("models_form_save_button"),
		})
		.click();
	await expect(page).toHaveURL(/\/app\/models\/[0-9a-f-]{36}$/);

	const { data: model } = await api.as("admin").model.find({
		id: modelIdSchema.parse(new URL(page.url()).pathname.split("/").at(-1)),
	});
	expect(model.capabilities).toEqual([
		"tool-calling",
	]);
});

test("forms: eligible groups show member counts and replace the default group", async ({
	api,
	org,
	pageAs,
}) => {
	const providerName = await createProvider(api);
	const groupName = formsName("Reviewers");
	const { data: group } = await api.as("admin").group.create({
		name: groupName,
	});
	const groups = await api.as("admin").group.list({
		pageIndex: 0,
		pageSize: 100,
	});
	const allMembersGroup = groups.data.find(
		(candidate) => candidate.systemKey === "all_members",
	);
	if (!allMembersGroup) throw new Error("Missing All Members group");

	const page = await pageAs("admin");
	await enterApp(page, org.slug);
	await open(page, "/app/quotas/add");

	const poolName = formsName("Pool");
	await page.getByLabel(message("common_name_label")).fill(poolName);
	await pickProvider(page, providerName);
	await page
		.getByRole("spinbutton", {
			name: message("quotas_form_budget_label"),
		})
		.fill("100");

	const input = page.getByRole("combobox", {
		name: message("quotas_form_groups_label"),
	});
	const allMembers = message("quotas_form_group_system_label", {
		name: allMembersGroup.name,
	});
	await expect(removeButton(page, allMembers)).toBeVisible();

	await input.fill(groupName);
	const option = page.getByRole("option", {
		name: groupName,
	});
	await expect(option).toContainText("0 members");
	await option.click();
	await expect(removeButton(page, groupName)).toBeVisible();
	await page.keyboard.press("Escape");

	// From the start of the input, Left Arrow reaches the pills.
	await input.press("ArrowLeft");
	await page.keyboard.press("ArrowLeft");
	await page.keyboard.press("Backspace");
	await expect(removeButton(page, allMembers)).toHaveCount(0);
	await expect(removeButton(page, groupName)).toBeVisible();

	await page
		.getByRole("button", {
			name: message("quotas_form_create_button"),
		})
		.click();
	await expect(page).toHaveURL(/\/app\/quotas\/[0-9a-f-]{36}$/);

	const { data: pool } = await api.as("admin").quota.find({
		id: quotaPoolIdSchema.parse(new URL(page.url()).pathname.split("/").at(-1)),
	});
	expect(pool.assignments.map((assignment) => assignment.groupId)).toEqual([
		group.id,
	]);
});

test("forms: an emptied eligible groups field names its error", async ({
	api,
	org,
	pageAs,
}) => {
	await createProvider(api);
	const admin = api.as("admin");
	const providers = await admin.provider.list({
		pageIndex: 0,
		pageSize: 100,
	});
	const provider = providers.data.at(0);
	if (!provider) throw new Error("Missing provider");
	const groupName = formsName("Only group");
	const { data: group } = await admin.group.create({
		name: groupName,
	});
	const { data: pool } = await admin.quota.create({
		name: formsName("Pool"),
		providerId: provider.id,
		periodType: "monthly",
		budgetAmount: 100,
		groupIds: [
			group.id,
		],
	});

	const page = await pageAs("admin");
	await enterApp(page, org.slug);
	await open(page, `/app/quotas/${pool.id}/edit`);

	const input = page.getByRole("combobox", {
		name: message("quotas_form_groups_label"),
	});
	await expect(input).not.toHaveAttribute("aria-invalid", "true");
	await removeButton(page, groupName).click();

	await expect(input).toHaveAttribute("aria-invalid", "true");
	const describedBy = (await input.getAttribute("aria-describedby")) ?? "";
	const error = page.locator(
		describedBy
			.split(" ")
			.map((id) => `[id="${id}"][role="alert"]`)
			.join(", "),
	);
	await expect(error).toBeVisible();
	const errorText = (await error.textContent()) ?? "";
	expect(errorText).not.toBe("");
	await expect(input).toHaveAccessibleDescription(
		`${message("quotas_form_groups_description")} ${errorText}`,
	);
});

test("forms: long lists scroll inside a still popup", async ({
	api,
	org,
	pageAs,
}) => {
	const admin = api.as("admin");
	for (let index = 0; index < 12; index++) {
		await createProvider(api);
		await admin.group.create({
			name: formsName(`Long list ${String(index)}`),
		});
	}

	const page = await pageAs("admin");
	await enterApp(page, org.slug);
	await open(page, "/app/quotas/add");
	await page.setViewportSize({
		width: 1280,
		height: 400,
	});

	await page
		.getByRole("combobox", {
			name: message("common_provider_label"),
		})
		.click();
	await expectListScrollsInside(
		page,
		page.locator("[data-slot=select-content]"),
	);
	await page.keyboard.press("Escape");

	const groups = page.getByRole("combobox", {
		name: message("quotas_form_groups_label"),
	});
	await groups.scrollIntoViewIfNeeded();
	await page
		.getByRole("button", {
			name: message("multi_select_show_options"),
		})
		.click();
	await expectListScrollsInside(
		page,
		page.locator("[data-slot=combobox-content]"),
	);
});
