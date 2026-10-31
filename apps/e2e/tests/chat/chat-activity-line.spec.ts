import {
	attachRepository,
	chatName,
	composer,
	createChat,
	openChat,
	setUpChatModel,
	turnFinished,
} from "../../fixtures/chat/chat";
import { expect, test } from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { enterApp } from "../../fixtures/navigation";

const SEARCHES = 8;
/** Eight model calls and searches outlast the default expect timeout on a loaded machine. */
const FULL_TURN = {
	timeout: 20_000,
};

test("a running turn shows its activity below the answer only while the work log shows none in view", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const model = await setUpChatModel(api, inference);
	const member = api.as("member");
	await member.user.setTourState({
		tourId: "chatTour",
		state: "completed",
	});
	const chatId = await createChat(member, model, chatName("Activity Line"));
	await attachRepository(member, chatId);

	const page = await pageAs("member");
	await page.setViewportSize({
		width: 1280,
		height: 600,
	});
	await enterApp(page, org.slug);
	await openChat(page, chatId);

	inference.script(
		...Array.from(
			{
				length: SEARCHES,
			},
			(_, index) => ({
				toolCalls: [
					{
						name: "searchRepositories",
						input: {
							query: `citation ${index + 1}`,
						},
					},
				],
			}),
		),
		{
			text: "Done.",
			hold: "response",
		},
	);
	await composer(page).fill("Check every citation.");
	await composer(page).press("Enter");
	await expect.poll(() => inference.held(), FULL_TURN).toBe(1);

	const log = page.getByRole("log");
	const working = message("chat_work_log_working");
	const activityLine = log.getByRole("button", {
		name: working,
		exact: true,
	});
	await expect(
		log.getByRole("status").filter({
			hasText: working,
		}),
	).toHaveText(working);
	await expect(activityLine).toHaveCount(0);

	const header = log.getByRole("button", {
		name: new RegExp(`^${SEARCHES} steps`),
	});
	await header.click();
	const entries = log.getByRole("listitem");
	await expect(entries).toHaveCount(SEARCHES);

	// Finished steps in view show no progress once the header is above them.
	await log.hover();
	await page.mouse.wheel(0, 20_000);
	await expect(entries.last()).toBeInViewport();
	await expect(header).not.toBeInViewport();
	await expect(activityLine).toBeVisible();

	await page.mouse.wheel(0, -20_000);
	await expect(header).toBeInViewport();
	await expect(activityLine).toHaveCount(0);

	inference.release();
	await turnFinished(page);
	await expect(
		log.getByRole("status").filter({
			hasText: working,
		}),
	).toHaveCount(0);
});
