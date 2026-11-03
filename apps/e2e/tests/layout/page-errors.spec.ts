import { test } from "../../fixtures/index";
import { enterApp } from "../../fixtures/navigation";

test("layout: a page throwing an uncaught error fails its test", async ({
	org,
	pageAs,
}) => {
	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await Promise.all([
		page.waitForEvent("pageerror"),
		page.evaluate(() => {
			setTimeout(() => {
				throw new Error("Thrown on purpose");
			});
		}),
	]);

	// Marked only now, so a failure above still fails the test: what remains
	// is the fixture's check at the end of the test.
	test.fail();
});
