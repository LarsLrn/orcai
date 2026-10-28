import { chatName, type setUpChatModel } from "../chat/chat";
import { runId } from "../organisation";

/** A model on the chat provider that the organisation uses as its utility model; returns its provider model id. */
export const useUtilityModel = async (
	api: Parameters<typeof setUpChatModel>[0],
	orgId: string,
	providerId: Awaited<ReturnType<typeof setUpChatModel>>["providerId"],
	capabilities: ("text" | "image")[],
) => {
	const admin = api.as("admin");
	const providerModelId = `e2e-mock-utility-${runId()}`;
	const created = await admin.model.create({
		providerId,
		providerModelId,
		name: chatName("Utility Model"),
		description: "A utility model on the mock for the pipeline specs.",
		isDeprecated: false,
		capabilities,
	});
	await admin.organization.update({
		id: orgId,
		utilityModelId: created.data.id,
	});
	return providerModelId;
};
