import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { open } from "../../fixtures/navigation";

test("home: the welcome links the docs site from the app's runtime environment", async ({
	api,
	pageAs,
}) => {
	const docsUrl = process.env.WEB_URL?.replace(/\/$/, "");
	expect(docsUrl).toBeTruthy();

	// The home starts the initial tour for a user who has not seen it, and its
	// modal card makes the welcome inert.
	await api.as("member").user.setTourState({
		tourId: "initialTour",
		state: "completed",
	});

	const page = await pageAs("member");
	await open(page, "/app");

	await expect(
		page.getByRole("link", {
			name: message("home_about_link"),
		}),
	).toHaveAttribute("href", docsUrl as string);
});
