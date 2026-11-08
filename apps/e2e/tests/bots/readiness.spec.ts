import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";
import { runId } from "../../fixtures/organisation";

test("bots: deleting a behaviour another member's published bot uses moves the bot to draft and says why", async ({
	api,
	org,
	pageAs,
}) => {
	const admin = api.as("admin");
	const member = api.as("member");
	const behaviour = await admin.block.create({
		type: "behaviour",
		name: `E2E Readiness Behaviour ${runId()}`,
		status: "ready",
		config: {
			systemPrompt: "Created by the readiness spec.",
		},
	});
	await admin.resource.grant({
		resourceType: "block",
		resourceId: behaviour.data.id,
		principals: [
			{
				principalType: "user",
				principalId: org.users.member.id,
			},
		],
		role: "viewer",
	});
	const { data: bot } = await member.bot.save({
		name: `E2E Readiness Bot ${runId()}`,
		description: "Created by the readiness spec.",
		status: "ready",
		behaviourId: behaviour.data.id,
		repositoryIds: [],
	});

	await admin.block.delete({
		refs: [
			{
				id: behaviour.data.id,
			},
		],
	});

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await open(page, `/app/library/bots/${bot.id}`);
	const alert = page.getByRole("alert").filter({
		hasText: message("bots_detail_not_ready_title"),
	});
	await expect(alert).toBeVisible();
	await expect(alert).toContainText(
		message("error_bot_behaviour_block_required"),
	);
});
