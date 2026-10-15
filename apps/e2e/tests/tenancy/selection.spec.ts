import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { open } from "../../fixtures/navigation";
import { runId } from "../../fixtures/organisation";

test("choosing an organisation loads its home page", async ({
	orgs,
	pageAsWellKnownAdmin,
}) => {
	// A fresh organisation nobody writes to, so both chat lists end empty. The
	// picker searches names only, so the name stays unique across no-reset runs.
	const organisation = await orgs.create(`E2E Selection ${runId()}`);

	const page = await pageAsWellKnownAdmin();
	await open(page, "/select-organization");

	// The well-known admin owns every organisation the suite creates, and the
	// picker pages its cards.
	await page
		.getByPlaceholder(message("select_organisation_page_search_placeholder"))
		.fill(organisation.name);
	await page
		.getByRole("button")
		.filter({
			hasText: `@${organisation.slug}`,
		})
		.click();

	await expect(page).toHaveURL(/\/app(\/|$)/);

	// The lists mount while the selection still settles; each must reach its
	// result instead of loading forever.
	await expect(
		page.getByText(message("sidebar_chats_empty_state_title")),
	).toBeVisible();
	await expect(
		page.getByText(message("chat_list_empty_state_title")),
	).toBeVisible();
	await expect(
		page.getByRole("status", {
			name: "Loading",
		}),
	).toHaveCount(0);
});
