import type { BotId, OrganizationId, ProviderId } from "@orcai/core";
import { webSearchSource } from "@orcai/core";
import { type QueryClient, skipToken, useQuery } from "@tanstack/react-query";
import { GlobeIcon } from "lucide-react";
import {
	activeOrganizationQuery,
	useActiveOrganization,
} from "@/hooks/use-active-organization";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

/** Loads the provider the notice reads when the organisation searches with the chat's model. */
export const loadWebSearchNotice = async (
	queryClient: QueryClient,
	{
		organizationId,
		botId,
		providerId,
	}: {
		organizationId: OrganizationId;
		botId: BotId | null | undefined;
		providerId: ProviderId | null | undefined;
	},
) => {
	if (!botId || !providerId) return;
	const [{ data: organization }, { data: bot }] = await Promise.all([
		queryClient.query(activeOrganizationQuery(organizationId)),
		queryClient.query(
			orpc.bot.find.queryOptions({
				input: {
					id: botId,
				},
			}),
		),
	]);
	if (
		bot.features.webSearch === undefined ||
		organization.webSearchMode !== "native"
	) {
		return;
	}
	await queryClient.query(
		orpc.provider.find.queryOptions({
			input: {
				id: providerId,
			},
		}),
	);
};

/**
 * Says when a bot with web search on gets none: the organisation turned it
 * off, or the chat's model has no search of its own. The chat works either way.
 */
export const WebSearchNotice = ({
	botId,
	providerId,
}: {
	botId?: string | null;
	providerId?: ProviderId | null;
}) => {
	const { data: bot } = useQuery(
		orpc.bot.find.queryOptions({
			input: botId
				? {
						id: botId,
					}
				: skipToken,
		}),
	);
	const enabled = bot?.data.features.webSearch !== undefined;
	const { data: organization } = useActiveOrganization();
	const needsModel = organization?.data.webSearchMode === "native";
	const { data: provider } = useQuery(
		orpc.provider.find.queryOptions({
			input:
				needsModel && providerId
					? {
							id: providerId,
						}
					: skipToken,
		}),
	);

	if (!enabled || !organization || (needsModel && !provider)) {
		return null;
	}
	const source = webSearchSource({
		mode: organization.data.webSearchMode,
		providerId: organization.data.webSearchProviderId,
		modelKind: provider?.data.kind ?? null,
	});
	if (source.kind !== "none") {
		return null;
	}

	return (
		<div
			role="status"
			className="bg-muted/60 flex items-start gap-2.5 rounded-2xl px-4 py-3 text-sm"
		>
			<GlobeIcon className="text-foreground mt-0.5 size-4 shrink-0" />
			<p className="text-foreground">
				{source.reason === "off"
					? m.chat_web_search_notice_off()
					: m.chat_web_search_notice_model()}
			</p>
		</div>
	);
};
