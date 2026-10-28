import { createWebSearch, providerApiKey } from "@orcai/ai";
import {
	type BotId,
	isSearchProviderKind,
	type ModelProviderKind,
	type OrganizationId,
	type UserId,
	webSearchSource,
} from "@orcai/core";
import * as Effect from "effect/Effect";
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import { Procedures } from "@/lib/orpc/implementation/procedures";
import { meteredWebSearch } from "./metered-web-search";
import { NO_WEB_SEARCH, type TurnWebSearch } from "./toolset";

/**
 * How the organisation's setting lets a bot's turn on a `modelKind` model search.
 * Search that cannot run leaves the turn without it rather than failing it.
 */
export const turnWebSearch = ({
	organizationId,
	userId,
	botId,
	modelKind,
	context,
}: {
	organizationId: OrganizationId;
	userId: UserId;
	botId: BotId;
	modelKind: ModelProviderKind;
	context: ORPCContext;
}) =>
	Effect.gen(function* () {
		const procedures = yield* Procedures;
		const { data: organization } = yield* procedures.organization.find(
			{
				id: organizationId,
			},
			{
				context,
			},
		);
		const source = webSearchSource({
			mode: organization.webSearchMode,
			providerId: organization.webSearchProviderId,
			modelKind,
		});

		switch (source.kind) {
			case "none":
				return NO_WEB_SEARCH;
			case "native":
				return {
					kind: "native",
					modelKind,
				} satisfies TurnWebSearch;
			case "provider": {
				const { data: provider } = yield* procedures.provider.find(
					{
						id: source.providerId,
					},
					{
						context,
					},
				);
				const { kind } = provider;
				if (!provider.enabled || !isSearchProviderKind(kind)) {
					yield* Effect.logWarning(
						`web_search.unavailable provider=${provider.id} enabled=${provider.enabled} kind=${kind}`,
					);
					return NO_WEB_SEARCH;
				}
				return {
					kind: "provider",
					search: meteredWebSearch({
						organizationId,
						userId,
						botId,
						providerId: provider.id,
						search: createWebSearch(kind, {
							apiKey: yield* providerApiKey(provider.id),
							endpoint: provider.endpoint,
						}),
					}),
				} satisfies TurnWebSearch;
			}
		}
	}).pipe(
		Effect.catch((error) =>
			Effect.logWarning("web_search.setup_failed", error).pipe(
				Effect.as(NO_WEB_SEARCH),
			),
		),
	);
