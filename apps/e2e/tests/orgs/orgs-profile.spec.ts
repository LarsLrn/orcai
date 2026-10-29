import type { Page } from "@playwright/test";
import { submitForm } from "../../fixtures/forms";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";
import { runId } from "../../fixtures/organisation";
import { openGuarded } from "../../fixtures/orgs/navigation";

const listedCounts = (page: Page) =>
	page.getByRole("navigation", {
		name: message("organization_profile_listed_label"),
	});

const editLink = (page: Page) =>
	page.getByRole("link", {
		name: message("organization_profile_edit_link"),
	});

test("orgs: an admin describes the organisation and a member of another reads it on its page", async ({
	api,
	org,
	orgs,
	pageAs,
	pageAsWellKnownAdmin,
}) => {
	test.slow();

	const created = await orgs.create(`E2E Orgs Profile ${runId()}`);
	const admin = await pageAs("admin", created);
	await enterApp(admin, created.slug);
	await openGuarded(
		admin,
		"/app/organization",
		message("orgs_settings_page_title"),
	);

	const editor = admin.getByRole("textbox", {
		name: message("orgs_form_description_label"),
	});
	await submitForm(admin, {
		fill: async () => {
			await editor.click();
			await admin.keyboard.type("We build tutoring bots for methods courses.");
		},
		submit: message("orgs_form_submit_button"),
		until: /\/app\/organization$/,
	});
	await expect
		.poll(
			async () =>
				(
					await api.as("admin", created).organization.profile({
						id: created.id,
					})
				).data.description,
		)
		.toMatchObject({
			type: "doc",
		});

	await open(admin, `/app/organizations/${created.id}`);
	await expect(
		admin.getByRole("heading", {
			level: 1,
			name: created.name,
		}),
	).toBeVisible();
	await expect(
		admin.getByText("We build tutoring bots for methods courses."),
	).toBeVisible();
	await expect(
		admin.getByText(message("organization_profile_active_badge")),
	).toBeVisible();
	// A new organisation lists nothing, so no count links to the catalogue.
	await expect(listedCounts(admin).getByRole("listitem")).toHaveCount(3);
	await expect(listedCounts(admin).getByRole("link")).toHaveCount(0);

	await editLink(admin).click();
	await expect(admin).toHaveURL(/\/app\/organization$/);

	// The Organisation menu item stays inactive on an organisation's page.
	await open(admin, `/app/organizations/${created.id}`);
	await expect(
		admin.locator("[data-sidebar] [data-active]").filter({
			hasText: message("sidebar_menu_organisation_item"),
		}),
	).toHaveCount(0);

	// From another active organisation, Edit switches to this one before
	// opening its settings. The well-known admin created and administers both.
	const creator = await pageAsWellKnownAdmin();
	await enterApp(creator, org.slug);
	await open(creator, `/app/organizations/${created.id}`);
	await creator
		.getByRole("button", {
			name: message("organization_profile_edit_link"),
		})
		.click();
	await expect(creator).toHaveURL(/\/app\/organization$/);
	await expect(creator.getByLabel(message("orgs_form_name_label"))).toHaveValue(
		created.name,
	);

	const reader = await pageAs("member");
	await enterApp(reader, org.slug);
	await open(reader, `/app/organizations/${created.id}`);
	await expect(
		reader.getByText("We build tutoring bots for methods courses."),
	).toBeVisible();
	await expect(
		reader.getByText(message("organization_profile_active_badge")),
	).toHaveCount(0);
	await expect(editLink(reader)).toHaveCount(0);
});

test("orgs: the catalogue links a listed entry's organisation to its page, whose counts lead back filtered", async ({
	api,
	org,
	orgs,
	pageAs,
}) => {
	test.slow();

	const name = `E2E Orgs Profile Behaviour ${runId()}`;
	const author = api.as("member");
	const { data: behaviour } = await author.block.create({
		type: "template",
		name,
		status: "ready",
		config: {
			systemPrompt: "Answer like a methods tutor.",
		},
	});
	await author.resource.setVisibility({
		resourceType: "block",
		resourceId: behaviour.id,
		visibility: "public",
		listBlockIds: [],
	});

	const other = await orgs.create(`E2E Orgs Profile Reader ${runId()}`);
	const reader = await pageAs("admin", other);
	await enterApp(reader, other.slug);
	await open(reader, "/app/catalogue/behaviours");
	const tile = reader.locator('[data-slot="tile"]').filter({
		hasText: name,
	});
	await tile
		.getByRole("link", {
			name: org.name,
		})
		.click();
	await expect(reader).toHaveURL(new RegExp(`/app/organizations/${org.id}$`));
	await expect(
		reader.getByRole("heading", {
			level: 1,
			name: org.name,
		}),
	).toBeVisible();

	const { data: profile } = await api.as("admin", other).organization.profile({
		id: org.id,
	});
	expect(profile.listed.behaviour).toBeGreaterThan(0);

	// The counts read "<n> Behaviours"; the message has variants, so match its words.
	await listedCounts(reader)
		.getByRole("link")
		.filter({
			hasText: /Behaviours?$/,
		})
		.click();
	await expect(reader).toHaveURL(/\/app\/catalogue\/behaviours\?/);
	await expect(
		reader.getByRole("link", {
			name: message("catalogue_organisation_page_link", {
				organisation: org.name,
			}),
		}),
	).toBeVisible();
	await expect(
		reader.locator('[data-slot="tile"]').filter({
			hasText: name,
		}),
	).toBeVisible();
});
