import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { BotIcon, EditIcon, PlusIcon, TrashIcon } from "lucide-react";
import { BotCard } from "@/components/bot/bot-card";
import { FAVOURITE_BOTS_INPUT } from "@/components/bot/bot-favourites";
import { Placeholder } from "@/components/placeholders/placeholder";
import { buttonVariants } from "@/components/ui/button";
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
import { useDeleteBotsMutation } from "@/hooks/mutations/use-bot-mutations";
import { hasCapability } from "@/lib/authz/capabilities";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/hub/bots/")({
	loader: async ({ context: { queryClient } }) => {
		await Promise.all([
			queryClient.query(
				orpc.bot.list.queryOptions({
					input: FAVOURITE_BOTS_INPUT,
					staleTime: "static",
				}),
			),
			queryClient.query(
				orpc.bot.list.queryOptions({
					input: {
						pageIndex: 0,
						pageSize: 50,
					},
					staleTime: "static",
				}),
			),
			queryClient.query(
				orpc.bot.listDrafts.queryOptions({
					input: {
						pageIndex: 0,
						pageSize: 50,
					},
					staleTime: "static",
				}),
			),
		]);
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { data: favourites } = useSuspenseQuery(
		orpc.bot.list.queryOptions({
			input: FAVOURITE_BOTS_INPUT,
		}),
	);
	const { data: bots } = useSuspenseQuery(
		orpc.bot.list.queryOptions({
			input: {
				pageIndex: 0,
				pageSize: 50,
			},
		}),
	);
	const { data: drafts } = useSuspenseQuery(
		orpc.bot.listDrafts.queryOptions({
			input: {
				pageIndex: 0,
				pageSize: 50,
			},
		}),
	);
	const { data: organizationCapabilities } = useOrganizationCapabilities([
		"create_bot",
	]);
	const canCreateBot = hasCapability(
		organizationCapabilities?.data.capabilities,
		"create_bot",
	);

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
					<SectionContent>
						<SectionGrid layout="3">
							{favourites.data.map((bot) => (
								<BotCard
									key={bot.id}
									bot={bot}
									actions={{
										footer: [],
									}}
								/>
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
				<SectionContent>
					{bots.data.length === 0 ? (
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
						<SectionGrid layout="3">
							{bots.data.map((bot) => (
								<BotCard
									key={bot.id}
									bot={bot}
									actions={{
										footer: [],
									}}
								/>
							))}
						</SectionGrid>
					)}
				</SectionContent>
			</Section>

			{drafts.data.length > 0 && (
				<Section>
					<SectionHeader>
						<SectionTitle>{m.bots_list_drafts_title()}</SectionTitle>
						<SectionDescription>
							{m.bots_list_drafts_description()}
						</SectionDescription>
					</SectionHeader>
					<SectionContent>
						<SectionGrid layout="3">
							{drafts.data.map((bot) => (
								<DraftBotCard key={bot.id} bot={bot} />
							))}
						</SectionGrid>
					</SectionContent>
				</Section>
			)}
		</div>
	);
}

const DraftBotCard = ({
	bot,
}: {
	bot: React.ComponentProps<typeof BotCard>["bot"];
}) => {
	const navigate = useNavigate();
	const { mutate: deleteBots } = useDeleteBotsMutation(
		{},
		{
			names: [
				bot.name,
			],
		},
	);

	return (
		<BotCard
			bot={bot}
			actions={{
				dropdown: [
					...(hasCapability(bot.capabilities, "edit")
						? [
								{
									key: "edit",
									label: m.bots_list_draft_edit_action(),
									icon: EditIcon,
									onClick: () =>
										navigate({
											to: "/app/hub/bots/$botId/setup",
											params: {
												botId: bot.id,
											},
										}),
								},
							]
						: []),
					...(hasCapability(bot.capabilities, "delete")
						? [
								{
									key: "delete",
									label: m.bots_list_draft_delete_action(),
									icon: TrashIcon,
									onClick: () =>
										deleteBots({
											refs: [
												{
													id: bot.id,
												},
											],
										}),
								},
							]
						: []),
				],
				footer: [],
			}}
		/>
	);
};
