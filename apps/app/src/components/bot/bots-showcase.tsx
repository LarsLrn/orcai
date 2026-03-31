import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { SparklesIcon } from "lucide-react";
import { Placeholder } from "@/components/placeholders/placeholder";
import { SkeletonsArray } from "@/components/placeholders/skeletons-array";
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
import { Skeleton } from "@/components/ui/skeleton";
import { orpc } from "@/lib/orpc/orpc";
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

	return (
		<Section>
			<SectionHeader>
				<SectionTitle>Available Chatbots</SectionTitle>
				<SectionDescription>
					Open a configured bot and jump into a focused chat.
				</SectionDescription>
				<SectionAction>
					<Link
						to="/app/hub/bots"
						className={buttonVariants({
							variant: "outline",
							size: "sm",
							className: "w-full sm:w-auto",
						})}
					>
						Open library
					</Link>
				</SectionAction>
			</SectionHeader>

			<SectionContent>
				{bots.data.length === 0 ? (
					<Placeholder
						title="No bots yet"
						description="Create a bot to see it showcased here."
						actions={[
							{
								key: "create_bot",
								label: "Create bot",
								icon: SparklesIcon,
								variant: "outline",
								linkProps: {
									to: "/app/hub/bots/add",
								},
							},
						]}
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
											label: "Start chat",
											onClick: () =>
												navigate({
													to: "/app/chat/new",
													search: {
														botId: bot.id,
													},
												}),
											variant: "default",
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

const BotsShowcaseSkeleton = () => (
	<section className="space-y-4">
		<div className="space-y-2">
			<Skeleton className="h-7 w-40" />
			<Skeleton className="h-4 w-64" />
		</div>
		<Skeleton className="h-9 w-32" />
		<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
			<SkeletonsArray className="h-48 w-full" count={3} />
		</div>
	</section>
);

export { BotsShowcase, BotsShowcaseSkeleton };
