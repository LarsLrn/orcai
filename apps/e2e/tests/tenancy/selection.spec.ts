import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { open } from "../../fixtures/navigation";
import { runId } from "../../fixtures/organisation";

test("choosing an organisation loads its home page", async ({
	orgs,
	pageAsWellKnownAdmin,
}) => {
	// Fresh organisations nobody writes to, so both chat lists end empty. The
	// picker searches names only, so the prefix stays unique across no-reset runs.
	const prefix = `E2E Selection ${runId()}`;
	const organisation = await orgs.create(`${prefix} A`);
	const other = await orgs.create(`${prefix} B`);

	const page = await pageAsWellKnownAdmin();
	await open(page, "/select-organization");

	// The well-known admin owns every organisation the suite creates, and the
	// picker pages its cards.
	await page
		.getByPlaceholder(message("select_organisation_page_search_placeholder"))
		.fill(prefix);

	const card = (slug: string) =>
		page
			.locator('[data-slot="tile"]')
			.filter({
				hasText: `@${slug}`,
			})
			.getByRole("button");
	await expect(card(other.slug)).toBeVisible();

	// While one selection runs, the other cards wait for it.
	let release!: () => void;
	const held = new Promise<void>((resolve) => {
		release = resolve;
	});
	await page.route("**/api/rpc/user/setActiveOrganization", async (route) => {
		await held;
		await route.continue();
	});

	await card(organisation.slug).click();
	await expect(card(organisation.slug)).toHaveAttribute("aria-busy", "true");
	await expect(card(organisation.slug)).toBeFocused();
	await expect(card(other.slug)).toBeDisabled();
	release();

	// A fresh organisation's admin lands on Manage until its setup is done.
	await expect(page).toHaveURL(/\/app\/manage$/);

	// The lists mount while the selection still settles; each must reach its
	// result instead of loading forever.
	await expect(
		page.getByText(message("sidebar_chats_empty_state_title")),
	).toBeVisible();
	await expect(
		page.getByText(message("readiness_card_title"), {
			exact: true,
		}),
	).toBeVisible();
	await expect(
		page.getByRole("status", {
			name: "Loading",
		}),
	).toHaveCount(0);
});
