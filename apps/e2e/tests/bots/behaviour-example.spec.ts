import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";
import { runId } from "../../fixtures/organisation";

for (const locale of [
	"en",
	"de",
] as const) {
	test(`bots: the behaviour example fills the system prompt in ${locale}`, async ({
		appBaseURL,
		org,
		pageAs,
	}) => {
		const page = await pageAs("member");
		await enterApp(page, org.slug);
		await page.context().addCookies([
			{
				name: "PARAGLIDE_LOCALE",
				value: locale,
				url: appBaseURL,
			},
		]);
		await open(page, "/app/library/bots/add");
		await page
			.getByLabel(message("authoring_basics_name_label", {}, locale))
			.fill(`E2E Example Bot ${runId()}`);
		await page
			.getByLabel(message("authoring_basics_description_label", {}, locale))
			.fill("Created by the behaviour example spec.");
		await page
			.getByRole("button", {
				name: message("common_next_button", {}, locale),
			})
			.click();
		await expect(page).toHaveURL(/\/app\/library\/bots\/[^/]+\/setup\?step=1/);

		await page
			.getByRole("button", {
				name: message("authoring_behaviour_create_action", {}, locale),
			})
			.click();

		const prompt = page.getByLabel(
			message("authoring_behaviour_system_prompt_label", {}, locale),
		);
		await expect(prompt).toHaveValue("");
		await page
			.getByRole("button", {
				name: message("authoring_behaviour_example_button", {}, locale),
			})
			.click();

		await expect(prompt).toHaveValue(
			message("authoring_behaviour_example", {}, locale),
		);
	});
}
