import type { ProviderId } from "@orcai/core";
import { webSearchSource } from "@orcai/core";
import { skipToken, useQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { GlobeIcon } from "lucide-react";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

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
	const { auth } = useRouteContext({
		from: "/app",
	});
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
	const organizationId = auth.session.activeOrganizationId;
	const { data: organization } = useQuery(
		orpc.organization.find.queryOptions({
			input:
				enabled && organizationId
					? {
							id: organizationId,
						}
					: skipToken,
		}),
	);
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
			className="flex items-start gap-2.5 rounded-2xl bg-muted/60 px-4 py-3 text-sm"
		>
			<GlobeIcon className="mt-0.5 size-4 shrink-0 text-foreground" />
			<p className="text-foreground">
				{source.reason === "off"
					? m.chat_web_search_notice_off()
					: m.chat_web_search_notice_model()}
			</p>
		</div>
	);
};
