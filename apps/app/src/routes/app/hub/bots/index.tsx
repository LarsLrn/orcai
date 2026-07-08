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
			queryClient.ensureQueryData(
				orpc.bot.list.queryOptions({
					input: {
						pageIndex: 0,
						pageSize: 50,
					},
				}),
			),
			queryClient.ensureQueryData(
				orpc.bot.listDrafts.queryOptions({
					input: {
						pageIndex: 0,
						pageSize: 50,
					},
				}),
			),
		]);
	},
	component: RouteComponent,
});

function RouteComponent() {
	const navigate = useNavigate();
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
	const { mutate: deleteBots } = useDeleteBotsMutation();
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
						Configured AI experiences ready to use in chats across your
						workspace.
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
								Create Bot
							</Link>
						</SectionAction>
					) : null}
				</SectionHeader>
				<SectionContent>
					{bots.data.length === 0 ? (
						<Placeholder
							Icon={BotIcon}
							title="No published bots yet"
							description="Create and publish a bot to make it available for chats."
							actions={
								canCreateBot
									? [
											{
												key: "create",
												label: "Create Bot",
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
						<SectionTitle>Your Drafts</SectionTitle>
						<SectionDescription>
							Resume bot setups that have not been published yet.
						</SectionDescription>
					</SectionHeader>
					<SectionContent>
						<SectionGrid layout="3">
							{drafts.data.map((bot) => (
								<BotCard
									key={bot.id}
									bot={bot}
									actions={{
										dropdown: [
											...(hasCapability(bot.capabilities, "edit")
												? [
														{
															key: "edit",
															label: "Edit Draft",
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
															label: "Delete Draft",
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
							))}
						</SectionGrid>
					</SectionContent>
				</Section>
			)}
		</div>
	);
}
