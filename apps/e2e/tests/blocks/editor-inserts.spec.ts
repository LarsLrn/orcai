import type { Page } from "@playwright/test";
import {
	type Api,
	expect,
	test,
	type WorkerOrganisation,
} from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";
import { runId } from "../../fixtures/organisation";

/** A member's own behaviour, open in its edit form. */
const openBehaviourEditor = async ({
	api,
	org,
	pageAs,
	viewport,
}: {
	api: Api;
	org: WorkerOrganisation;
	pageAs: (role: "member") => Promise<Page>;
	viewport?: {
		width: number;
		height: number;
	};
}) => {
	const block = await api.as("member").block.create({
		type: "template",
		name: `E2E Editor Inserts ${runId()}`,
		status: "ready",
		config: {
			systemPrompt: "Created by the editor inserts spec.",
		},
	});
	const detailPath = `/app/library/behaviours/${block.data.id}`;

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	if (viewport) {
		await page.setViewportSize(viewport);
	}
	await open(page, `${detailPath}/edit`);

	return {
		page,
		detailPath,
		editor: page.getByLabel(message("blocks_template_form_content_label")),
	};
};

const toolbarButton = (page: Page, key: string) =>
	page.getByRole("button", {
		name: message(key),
		exact: true,
	});

test("blocks: a behaviour's description takes a table and a YouTube video", async ({
	api,
	org,
	pageAs,
}) => {
	const { page, detailPath, editor } = await openBehaviourEditor({
		api,
		org,
		pageAs,
	});
	await editor.click();

	await toolbarButton(page, "editor_toolbar_youtube_tooltip").click();
	const link = page.getByLabel(
		message("editor_toolbar_youtube_popover_label"),
		{
			exact: true,
		},
	);
	const insert = page.getByRole("button", {
		name: message("editor_toolbar_youtube_insert_button"),
	});
	await link.fill("https://youtube.com/not-a-video");
	await expect(
		page.getByText(message("editor_toolbar_youtube_invalid_error")),
	).toBeVisible();
	await expect(insert).toBeDisabled();
	await link.fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
	await insert.click();
	await expect(editor.locator("iframe")).toHaveCount(1);

	await toolbarButton(page, "editor_toolbar_table_tooltip").click();
	await expect(editor.getByRole("table")).toBeVisible();
	await page.keyboard.type("First cell");

	await page
		.getByRole("button", {
			name: message("blocks_template_form_update_submit_button"),
		})
		.click();
	await expect(page).toHaveURL(new RegExp(`${detailPath}$`));

	const table = page.getByRole("table");
	await expect(
		table.getByRole("columnheader", {
			name: "First cell",
		}),
	).toBeVisible();
	await expect(table.getByRole("row")).toHaveCount(3);
	await expect(page.locator("iframe")).toHaveAttribute(
		"src",
		"https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
	);
});

test("blocks: the editor toolbar scrolls to its inserts on a phone", async ({
	api,
	org,
	pageAs,
}) => {
	const { page, editor } = await openBehaviourEditor({
		api,
		org,
		pageAs,
		viewport: {
			width: 390,
			height: 844,
		},
	});

	await expect(
		toolbarButton(page, "editor_toolbar_undo_tooltip"),
	).toBeVisible();
	const insertTable = toolbarButton(page, "editor_toolbar_table_tooltip");
	await expect(insertTable).not.toBeInViewport();
	await insertTable.scrollIntoViewIfNeeded();
	await expect(insertTable).toBeInViewport();
	await expect(
		toolbarButton(page, "editor_toolbar_youtube_tooltip"),
	).toBeInViewport();

	await editor.click();
	await insertTable.click();
	await expect(editor.getByRole("table")).toBeVisible();
});
