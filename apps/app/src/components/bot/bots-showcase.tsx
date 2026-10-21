import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { BotIcon, SparklesIcon } from "lucide-react";
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
import { hasCapability } from "@/lib/authz/capabilities";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";
import { BotCard } from "./bot-card";

const BotsShowcase = ({ limit = 6 }: { limit?: number }) => {
	const navigate = useNavigate();
	const { data: bots } = useSuspenseQuery(
		orpc.bot.list.queryOptions({
			input: {
				pageIndex: 0,
				pageSize: limit,
			},
		}),
	);

	const { data: organizationCapabilities } = useOrganizationCapabilities();
	const canCreateBot = hasCapability(
		organizationCapabilities?.data.capabilities,
		"create_bot",
	);

	return (
		<Section>
			<SectionHeader>
				<SectionTitle>{m.bots_showcase_title()}</SectionTitle>
				<SectionDescription>{m.bots_showcase_description()}</SectionDescription>
				<SectionAction>
					<Link
						to="/app/hub/bots"
						className={buttonVariants({
							variant: "outline",
							size: "sm",
							className: "w-full sm:w-auto",
						})}
					>
						{m.bots_showcase_view_all_action()}
					</Link>
				</SectionAction>
			</SectionHeader>

			<SectionContent>
				{bots.data.length === 0 ? (
					<Placeholder
						Icon={BotIcon}
						tone="bot"
						title={m.bots_showcase_empty_title()}
						description={m.bots_showcase_empty_description()}
						actions={
							canCreateBot
								? [
										{
											key: "create_bot",
											label: m.bots_showcase_create_action(),
											icon: SparklesIcon,
											variant: "outline",
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
									footer: [
										{
											key: "start_chat",
											label: m.bots_showcase_start_chat_action(),
											onClick: () =>
												navigate({
													to: "/app/chat/new",
													search: {
														botId: bot.id,
													},
												}),
											variant: "outline",
										},
									],
								}}
							/>
						))}
					</SectionGrid>
				)}
			</SectionContent>
		</Section>
	);
};

export { BotsShowcase };
