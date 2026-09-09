import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { BotIcon, EditIcon, PlusIcon, TrashIcon } from "lucide-react";
import { BotCard } from "@/components/bot/bot-card";
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

export const Route = createFileRoute("/app/hub/bots/")({
	loader: async ({ context: { queryClient } }) => {
		await Promise.all([
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
			<Section>
				<SectionHeader>
					<SectionTitle>Published</SectionTitle>
					<SectionDescription>
						Bots ready to use in chats across your workspace. A bot bundles a
						behaviour, its repositories, a model and its access rules.
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
								Create bot
							</Link>
						</SectionAction>
					) : null}
				</SectionHeader>
				<SectionContent>
					{bots.data.length === 0 ? (
						<Placeholder
							Icon={BotIcon}
							tone="bot"
							title="No published bots yet"
							description="Create and publish a bot to make it available for chats."
							actions={
								canCreateBot
									? [
											{
												key: "create",
												label: "Create bot",
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
						<SectionTitle>Your drafts</SectionTitle>
						<SectionDescription>
							Resume bot setups that have not been published yet.
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
									label: "Edit draft",
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
									label: "Delete draft",
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
