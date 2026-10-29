import type { Page } from "@playwright/test";
import { storeLocale } from "../../fixtures/account/locale";
import { createApiClient } from "../../fixtures/api";
import { expectEmailIn, queuedEmail } from "../../fixtures/emails/render";
import { submitForm } from "../../fixtures/forms";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { enterApp } from "../../fixtures/navigation";
import {
	INVITED_NOTIFICATION,
	invitationEmail,
	inviteEmail,
} from "../../fixtures/orgs/invitations";
import { addMember, createOrgsUser } from "../../fixtures/orgs/members";
import { openGuarded } from "../../fixtures/orgs/navigation";

/**
 * The first address field. By role, because a label also matches the hidden
 * copy React streams for the form before revealing it.
 */
const firstEmailField = (page: Page, locale: "en" | "de") =>
	page.getByRole("textbox", {
		name: message(
			"orgs_invitation_form_email_label",
			{
				position: 1,
			},
			locale,
		),
		exact: true,
	});

const invitedCopy = (organisationName: string) => ({
	subject: "email_organization_invited_subject",
	subjectVariables: {
		organization: organisationName,
	},
	text: "email_organization_invited_action",
});

test("orgs: the email language picked in the invitation form decides the invitation email", async ({
	org,
	outbox,
	pageAs,
}) => {
	const email = invitationEmail("locale-picked");
	const page = await pageAs("admin");

	await enterApp(page, org.slug);
	await openGuarded(
		page,
		"/app/members/add",
		message("members_add_page_title"),
	);

	// The form starts on the inviter's interface language, English here.
	const language = page.getByRole("combobox", {
		name: message("orgs_invitation_form_locale_label"),
	});
	await expect(language).toContainText("English");
	await language.click();
	await page
		.getByRole("option", {
			name: "Deutsch",
		})
		.click();
	await expect(language).toContainText("Deutsch");

	await submitForm(page, {
		fill: async () => {
			await firstEmailField(page, "en").fill(email);
		},
		submit: message("orgs_invitation_form_submit_button"),
		until: /\/app\/members\/invitations/,
	});
	await expect(
		page.getByRole("heading", {
			name: message("members_invitations_page_title"),
		}),
	).toBeVisible();

	await expectEmailIn(
		await queuedEmail(outbox, email, INVITED_NOTIFICATION),
		"de",
		invitedCopy(org.name),
	);
});

test("orgs: an untouched email language follows the inviter's interface language", async ({
	appBaseURL,
	org,
	outbox,
	pageAs,
}) => {
	const email = invitationEmail("locale-default");
	const page = await pageAs("admin");

	await enterApp(page, org.slug);

	// German for this browser only; a switcher click would also store it for
	// the worker's shared admin.
	await page.context().addCookies([
		{
			name: "PARAGLIDE_LOCALE",
			value: "de",
			url: appBaseURL,
		},
	]);
	await openGuarded(
		page,
		"/app/members/add",
		message("members_add_page_title", {}, "de"),
	);
	await expect(
		page.getByRole("combobox", {
			name: message("orgs_invitation_form_locale_label", {}, "de"),
		}),
	).toContainText("Deutsch");

	await submitForm(page, {
		fill: async () => {
			await firstEmailField(page, "de").fill(email);
		},
		submit: message("orgs_invitation_form_submit_button", {}, "de"),
		until: /\/app\/members\/invitations/,
	});
	await expect(
		page.getByRole("heading", {
			name: message("members_invitations_page_title", {}, "de"),
		}),
	).toBeVisible();

	await expectEmailIn(
		await queuedEmail(outbox, email, INVITED_NOTIFICATION),
		"de",
		invitedCopy(org.name),
	);
});

test("orgs: an API invitation without a language uses the inviter's stored language", async ({
	api,
	appBaseURL,
	org,
	outbox,
	zedTokens,
}) => {
	// A dedicated inviter, so the worker's shared admin keeps its language.
	const inviter = await createOrgsUser(appBaseURL, "locale-inviter");
	await addMember(api.as("admin"), {
		user: inviter,
		role: "admin",
		zedTokens,
	});
	await storeLocale(appBaseURL, inviter.session, "de");

	const email = invitationEmail("locale-stored");
	await inviteEmail(
		createApiClient(appBaseURL, inviter.session.cookieHeader, zedTokens),
		{
			email,
			role: "viewer",
		},
	);

	await expectEmailIn(
		await queuedEmail(outbox, email, INVITED_NOTIFICATION),
		"de",
		invitedCopy(org.name),
	);
});
