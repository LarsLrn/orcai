import { expect, type Page } from "@playwright/test";
import type { Role } from "../constants";

/** What the app calls each organisation role on screen. */
export const ROLE_LABELS: Record<Role, string> = {
	admin: "Admin",
	manager: "Manager",
	member: "Member",
	viewer: "Viewer",
};

/** The role picker button, named after the role it currently shows. */
export const rolePicker = (page: Page, currentRole: Role) =>
	page.getByRole("button", {
		name: ROLE_LABELS[currentRole],
		exact: true,
	});

/** One role in the open picker; its name carries the permission summary, so match by prefix. */
export const roleOption = (page: Page, role: Role) =>
	page.getByRole("option", {
		name: new RegExp(`^${ROLE_LABELS[role]}\\b`),
	});

/** Open the role picker, retrying late hydration while the dialog is still closed. */
export const openRolePicker = async (
	page: Page,
	currentRole: Role,
): Promise<void> => {
	await expect(async () => {
		if (!(await roleOption(page, currentRole).isVisible())) {
			await rolePicker(page, currentRole).click();
		}

		await expect(roleOption(page, currentRole)).toBeVisible({
			timeout: 3_000,
		});
	}).toPass({
		timeout: 20_000,
	});
};

/** Pick a different role in the picker that currently shows `from`. */
export const chooseRole = async (
	page: Page,
	from: Role,
	to: Role,
): Promise<void> => {
	await openRolePicker(page, from);
	await roleOption(page, to).click();
};
