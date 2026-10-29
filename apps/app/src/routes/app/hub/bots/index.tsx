import { useSuspenseQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	stripSearchParams,
} from "@tanstack/react-router";
import { BotIcon, PlusIcon } from "lucide-react";
import { FAVOURITE_BOTS_INPUT } from "@/components/bot/bot-favourites";
import { BotTile } from "@/components/bot/bot-tile";
import { Placeholder } from "@/components/placeholders/placeholder";
import { buttonVariants } from "@/components/ui/button";
import {
	CardPager,
	libraryPagingDefaults,
	libraryPagingSchema,
	useClampedPageIndex,
} from "@/components/ui/card-pager";
import {
	Section,
	SectionAction,
	SectionContent,
	SectionDescription,
	SectionGrid,
	SectionHeader,
	SectionTitle,
} from "@/components/ui/shell/section";
import { useOrganizationCapabilities } from "@/hooks/authz/use-capabilities";
import { hasCapability } from "@/lib/authz/capabilities";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

const listInput = (
	pageIndex: number,
	pageSize: number,
	status: "ready" | "draft",
) => ({
	pageIndex,
	pageSize,
	filters: {
		status,
	},
});

export const Route = createFileRoute("/app/hub/bots/")({
	validateSearch: libraryPagingSchema,
	search: {
		middlewares: [
			stripSearchParams(libraryPagingDefaults),
		],
	},
	loaderDeps: ({ search: { pageIndex, pageSize, draftPageIndex } }) => ({
		pageIndex,
		pageSize,
		draftPageIndex,
	}),
	loader: async ({ context: { queryClient }, deps }) => {
		await Promise.all([
			queryClient.query(
				orpc.bot.list.queryOptions({
					input: FAVOURITE_BOTS_INPUT,
					staleTime: "static",
				}),
			),
			queryClient.query(
				orpc.bot.list.queryOptions({
					input: listInput(deps.pageIndex, deps.pageSize, "ready"),
					staleTime: "static",
				}),
			),
			queryClient.query(
				orpc.bot.list.queryOptions({
					input: listInput(deps.draftPageIndex, deps.pageSize, "draft"),
					staleTime: "static",
				}),
			),
		]);
	},
	component: RouteComponent,
});

function RouteComponent() {
	const search = Route.useSearch();
	const { data: favourites } = useSuspenseQuery(
		orpc.bot.list.queryOptions({
			input: FAVOURITE_BOTS_INPUT,
		}),
	);
	const { data: bots } = useSuspenseQuery(
		orpc.bot.list.queryOptions({
			input: listInput(search.pageIndex, search.pageSize, "ready"),
		}),
	);
	const { data: drafts } = useSuspenseQuery(
		orpc.bot.list.queryOptions({
			input: listInput(search.draftPageIndex, search.pageSize, "draft"),
		}),
	);
	const { data: organizationCapabilities } = useOrganizationCapabilities([
		"create_bot",
	]);
	const canCreateBot = hasCapability(
		organizationCapabilities?.data.capabilities,
		"create_bot",
	);

	useClampedPageIndex({
		rowCount: bots.rowCount,
		pageIndex: search.pageIndex,
		pageSize: search.pageSize,
	});
	useClampedPageIndex({
		rowCount: drafts.rowCount,
		pageIndex: search.draftPageIndex,
		pageSize: search.pageSize,
		indexKey: "draftPageIndex",
	});

	return (
		<div className="space-y-12">
			{favourites.data.length > 0 && (
				<Section>
					<SectionHeader>
						<SectionTitle>{m.bots_list_favourites_title()}</SectionTitle>
						<SectionDescription>
							{m.bots_list_favourites_description()}
						</SectionDescription>
					</SectionHeader>
					<SectionContent className="space-y-6">
						<SectionGrid layout="3">
							{favourites.data.map((bot) => (
								<BotTile key={bot.id} bot={bot} />
							))}
						</SectionGrid>
					</SectionContent>
				</Section>
			)}

			<Section>
				<SectionHeader>
					<SectionTitle>{m.bots_list_published_title()}</SectionTitle>
					<SectionDescription>
						{m.bots_list_published_description()}
					</SectionDescription>
					{canCreateBot ? (
						<SectionAction>
							<Link
								to="/app/hub/bots/add"
								className={buttonVariants({
									size: "sm",
								})}
							>
								<PlusIcon />
								{m.bots_list_create_action()}
							</Link>
						</SectionAction>
					) : null}
				</SectionHeader>
				<SectionContent className="space-y-6">
					{bots.rowCount === 0 ? (
						<Placeholder
							Icon={BotIcon}
							tone="bot"
							title={m.bots_list_empty_state_title()}
							description={m.bots_list_empty_state_description()}
							actions={
								canCreateBot
									? [
											{
												key: "create",
												label: m.bots_list_create_action(),
												icon: PlusIcon,
												variant: "default",
												linkProps: {
													to: "/app/hub/bots/add",
												},
											},
										]
									: []
							}
						/>
					) : (
						<>
							<SectionGrid layout="3">
								{bots.data.map((bot) => (
									<BotTile key={bot.id} bot={bot} />
								))}
							</SectionGrid>
							<CardPager
								rowCount={bots.rowCount}
								pageIndex={search.pageIndex}
								pageSize={search.pageSize}
							/>
						</>
					)}
				</SectionContent>
			</Section>

			{drafts.rowCount > 0 && (
				<Section>
					<SectionHeader>
						<SectionTitle>{m.bots_list_drafts_title()}</SectionTitle>
						<SectionDescription>
							{m.bots_list_drafts_description()}
						</SectionDescription>
					</SectionHeader>
					<SectionContent className="space-y-6">
						<SectionGrid layout="3">
							{drafts.data.map((bot) => (
								<BotTile key={bot.id} bot={bot} />
							))}
						</SectionGrid>
						<CardPager
							rowCount={drafts.rowCount}
							pageIndex={search.draftPageIndex}
							pageSize={search.pageSize}
							indexKey="draftPageIndex"
						/>
					</SectionContent>
				</Section>
			)}
		</div>
	);
}
