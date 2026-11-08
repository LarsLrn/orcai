import { uploadAsset } from "../../fixtures/assets";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";

test("home: the Library panel counts bots with their drafts, published behaviours and repositories, and no chat uploads", async ({
	api,
	orgs,
	pageAs,
}) => {
	const fresh = await orgs.create("E2E Home Library");
	const admin = api.as("admin", fresh);
	const behaviour = (name: string, status: "ready" | "draft") =>
		admin.block.create({
			type: "behaviour",
			name,
			status,
			config: {
				systemPrompt: "Created by the Home Library spec.",
			},
		});
	const published = await behaviour("E2E Home Behaviour", "ready");
	await behaviour("E2E Home Draft Behaviour", "draft");
	await admin.block.create({
		type: "repository",
		name: "E2E Home Repository",
		status: "ready",
		config: {
			minPassages: 1,
			maxPassages: 5,
			defaultPassages: 3,
		},
	});
	const bot = (name: string) =>
		admin.bot.save({
			name,
			description: "Created by the Home Library spec.",
			status: "draft",
			behaviourId: published.data.id,
			repositoryIds: [],
		});
	const { data: shown } = await bot("E2E Home Bot");
	await bot("E2E Home Draft Bot");
	await admin.bot.publish({
		id: shown.id,
	});
	await uploadAsset(admin, "home-library-notes.txt");
	await uploadAsset(admin, "home-chat-notes.txt", {
		route: "chatAttachment",
	});

	const page = await pageAs("admin", fresh);
	await enterApp(page, fresh.slug);
	await open(page, "/app/manage");
	const panel = page.locator("section").filter({
		has: page.getByRole("heading", {
			name: message("home_library_panel_title"),
		}),
	});
	const row = (label: string) =>
		panel.getByRole("link").filter({
			has: page.getByText(label, {
				exact: true,
			}),
		});

	// The meta line has plural variants, so it is matched as rendered.
	await expect(row(message("home_library_bots_label"))).toContainText(
		"1 published, 1 draft",
	);
	await expect(row(message("home_library_bots_label"))).toContainText(/2$/);
	await expect(row(message("home_library_blocks_label"))).toContainText(/1$/);
	await expect(row(message("home_library_repositories_label"))).toContainText(
		/1$/,
	);
	await expect(row(message("home_library_assets_label"))).toContainText(/1$/);
});
