import type { OrganizationId } from "@orcai/core";
import { userIdSchema } from "@orcai/schema";
import { expect, type Locator, type Page } from "@playwright/test";
import { type ApiClient, createApiClient } from "../api";
import { signUpInvited } from "../auth";
import { EMAIL_DOMAIN } from "../constants";
import { baseURL } from "../env";
import { open } from "../navigation";
import { runId } from "../organisation";

/** A name no other test uses, so the spec can find its own rows. */
export const groupsName = (label: string): string =>
	`E2E Groups ${label} ${runId()}`;

/** A template block, the one grantable resource that needs no model, provider, or worker. */
export const templateBlock = (name: string) => ({
	type: "template" as const,
	name,
	status: "ready" as const,
	config: {
		systemPrompt: "Created by the groups slice.",
	},
});

/** The ids of a `block.list` page, for containment assertions. */
export const blockIds = async (
	list: Promise<{
		data: {
			id: string;
		}[];
	}>,
): Promise<string[]> => (await list).data.map((block) => block.id);

/** Open a page under `/en/app/groups`, retrying while snapshot lag makes the guard redirect. */
export const openGroupsPage = async (
	page: Page,
	path: string,
	visible: Locator,
): Promise<void> => {
	await expect(async () => {
		await open(page, path);
		await expect(visible).toBeVisible({
			timeout: 3_000,
		});
	}).toPass({
		timeout: 30_000,
	});
};

/** Create a group through the list page dialog, retrying late hydration without creating it twice. */
export const createGroupThroughUi = async (
	page: Page,
	name: string,
): Promise<void> => {
	const filtered = new URL(page.url());
	filtered.searchParams.set("query", name);
	filtered.searchParams.set("pageIndex", "0");
	await open(page, filtered.toString());
	const row = page.getByRole("link", {
		name,
	});
	const dialogTitle = page.getByRole("heading", {
		name: "Create Group",
	});

	await expect(async () => {
		if (await row.isVisible()) {
			return;
		}

		if (!(await dialogTitle.isVisible())) {
			await page
				.getByRole("button", {
					name: "Create Group",
				})
				.click();
		}

		await expect(dialogTitle).toBeVisible({
			timeout: 5_000,
		});
		await page.getByLabel("Name").fill(name);
		await page
			.getByRole("button", {
				name: "Create",
				exact: true,
			})
			.click();
		await expect(row).toBeVisible({
			timeout: 10_000,
		});
	}).toPass({
		timeout: 30_000,
	});
};

/** The member row for an email on the group detail page: the block around it that holds "Remove member". */
export const memberRow = (page: Page, email: string): Locator =>
	page
		.getByText(email, {
			exact: true,
		})
		.locator(
			'xpath=ancestor::div[.//button[normalize-space()="Remove member"]][1]',
		);

/** A member of the organisation that belongs to no group. */
export const outsiderMember = async (params: {
	admin: ApiClient;
	organisation: {
		id: OrganizationId;
	};
}): Promise<{
	client: ApiClient;
	userId: string;
}> => {
	const url = baseURL();
	const session = await signUpInvited({
		baseURL: url,
		admin: params.admin,
		organisation: params.organisation,
		role: "member",
		name: "E2E Groups Outsider",
		email: `e2e-groups-outsider-${runId()}@${EMAIL_DOMAIN}`,
	});

	return {
		client: createApiClient(url, session.cookieHeader),
		userId: userIdSchema.parse(session.userId),
	};
};
