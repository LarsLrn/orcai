import { rejection, untilAllowed } from "../../fixtures/authorization";
import { expect, test } from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";
import { runId } from "../../fixtures/organisation";

test.describe("provider model discovery", () => {
	test("discovery failures name what went wrong", async ({
		api,
		inference,
	}) => {
		const admin = api.as("admin");
		const provider = await untilAllowed(() =>
			admin.provider.create({
				name: `Discovery errors ${runId()}`,
				description: "",
				endpoint: inference.url,
				kind: "openai-compatible",
				meteringMode: "tokens",
				apiKey: "e2e-key",
				enabled: true,
			}),
		);
		const discover = () =>
			rejection(
				admin.model.discover({
					providerId: provider.data.id,
				}),
			);

		inference.failNext({
			status: 401,
		});
		expect((await discover()).data).toMatchObject({
			reason: "PROVIDER_MODELS_KEY_REJECTED",
		});

		inference.failNext({
			status: 404,
		});
		expect((await discover()).data).toMatchObject({
			reason: "PROVIDER_MODELS_LISTING_UNSUPPORTED",
		});

		// The SDK retries a server error twice before it gives up.
		for (let attempt = 0; attempt < 3; attempt++) {
			inference.failNext({
				status: 502,
			});
		}
		expect((await discover()).data).toMatchObject({
			reason: "PROVIDER_MODELS_UNREACHABLE",
		});
	});

	test("the provider page discovers its models", async ({
		api,
		inference,
		org,
		pageAs,
	}) => {
		const admin = api.as("admin");
		const provider = await untilAllowed(() =>
			admin.provider.create({
				name: `Discovery button ${runId()}`,
				description: "",
				endpoint: inference.url,
				kind: "openai-compatible",
				meteringMode: "tokens",
				apiKey: "e2e-key",
				enabled: true,
			}),
		);

		const page = await pageAs("admin");
		await enterApp(page, org.slug);
		await open(page, `/app/providers/${provider.data.id}`);

		await page
			.getByRole("button", {
				name: message("models_discover_trigger_button"),
			})
			.click();
		const dialog = page.getByRole("dialog");
		await expect(
			dialog.getByText(message("models_discover_provider_dialog_description")),
		).toBeVisible();
		await expect(
			dialog.getByRole("combobox", {
				name: message("common_provider_label"),
			}),
		).toHaveCount(0);

		inference.failNext({
			status: 404,
		});
		await dialog
			.getByRole("button", {
				name: message("models_discover_trigger_button"),
			})
			.click();
		await expect(
			dialog.getByText(message("error_provider_models_listing_unsupported")),
		).toBeVisible();

		await dialog
			.getByRole("button", {
				name: message("models_discover_trigger_button"),
			})
			.click();
		await expect(
			dialog.getByText(message("models_discover_success_title")),
		).toBeVisible();
		await dialog
			.getByRole("button", {
				name: message("common_close_button"),
			})
			.first()
			.click();

		await expect(
			page.getByRole("cell", {
				name: inference.models[0],
			}),
		).toBeVisible();
	});
});
