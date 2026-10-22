import type { ProviderId } from "@orcai/core";
import { chatName } from "../chat/chat";
import type { Api } from "../index";
import type { InferenceMock } from "../inference/fixture";

export const SEARCH_API_KEY = "tvly-e2e-key";

/**
 * A Tavily provider on the mock with a request pool for every member, chosen
 * as the organisation's web search.
 */
export const setUpSearchProvider = async (
	api: Api,
	inference: InferenceMock,
	organizationId: string,
): Promise<ProviderId> => {
	const admin = api.as("admin");
	const provider = await admin.provider.create({
		name: chatName("Search"),
		description: "Mock Tavily endpoint for the web search slice.",
		endpoint: inference.url,
		kind: "tavily",
		meteringMode: "requests",
		apiKey: SEARCH_API_KEY,
		enabled: true,
	});

	const groups = await admin.group.list({
		pageIndex: 0,
		pageSize: 100,
	});
	const allMembers = groups.data.find(
		(group) => group.systemKey === "all_members",
	);
	if (!allMembers) throw new Error("Missing All Members group");

	await admin.quota.create({
		name: chatName("Search Pool"),
		providerId: provider.data.id,
		periodType: "monthly",
		budgetAmount: 100,
		groupIds: [
			allMembers.id,
		],
	});

	await admin.organization.update({
		id: organizationId,
		webSearch: {
			mode: "provider",
			providerId: provider.data.id,
		},
	});

	return provider.data.id;
};

/** The searches the mock answered, oldest first. */
export const searchBodies = (inference: InferenceMock) =>
	inference.requests.filter(
		(request) => request.method === "POST" && request.path === "/v1/search",
	);
