import { Link, useNavigate } from "@tanstack/react-router";
import { BotIcon, PlusIcon } from "lucide-react";
import { Suspense } from "react";
import { UserWelcome } from "@/components/app/user-welcome";
import {
	BotsShowcase,
	BotsShowcaseSkeleton,
} from "@/components/bot/bots-showcase";
import { ChatsList } from "@/components/chat/chats-list";
import { NewChatInput } from "@/components/chat/new-chat-input";
import { useChatStarter } from "@/components/chat/use-chat-starter";
import { buttonVariants } from "@/components/ui/button";
import {
	Hero,
	HeroContent,
	HeroInner,
	HeroWave,
} from "@/components/ui/shell/hero";
import {
	Section,
	SectionAction,
	SectionContent,
	SectionDescription,
	SectionHeader,
	SectionTitle,
} from "@/components/ui/shell/section";

const QuickChatSection = () => {
	const navigate = useNavigate();
	const {
		selectedBotId,
		selectedModelId,
		selectedProviderId,
		isCreating,
		handleModelSelect,
		handleBotSelect,
		handleSend,
	} = useChatStarter({
		onChatCreated: (chatId, pendingMessage, zedToken) =>
			navigate({
				to: "/app/chat/$chatId",
				params: {
					chatId,
				},
				search: {
					zedToken,
				},
				state: (previous) => ({
					...previous,
					pendingMessage,
				}),
			}),
	});

	return (
		<Section>
			<SectionHeader>
				<SectionTitle>Dive right in</SectionTitle>
				<SectionAction>
					<Link
						to="/app/hub/bots"
						data-slot="button"
						className={buttonVariants({
							variant: "outline",
							size: "sm",
						})}
					>
						<BotIcon />
						Browse bots
					</Link>
				</SectionAction>
			</SectionHeader>
			<SectionContent>
				<div className="flex w-full max-w-3xl flex-col gap-3">
					<NewChatInput
						selectedBotId={selectedBotId}
						selectedModelId={selectedModelId}
						selectedProviderId={selectedProviderId}
						onBotSelect={handleBotSelect}
						onModelSelect={handleModelSelect}
						onSend={handleSend}
						isCreating={isCreating}
					/>
				</div>
			</SectionContent>
		</Section>
	);
};

const UserHome = () => {
	return (
		<div className="space-y-12">
			<Hero>
				<HeroWave />
				<HeroInner>
					<HeroContent>
						<UserWelcome />
					</HeroContent>
				</HeroInner>
			</Hero>

			<QuickChatSection />

			<Section>
				<SectionHeader>
					<SectionTitle>Your Recent Conversations</SectionTitle>
					<SectionDescription>
						Pick right back up where you left off.
					</SectionDescription>
					<SectionAction>
						<Link
							to={"/app/chat"}
							className={buttonVariants({
								variant: "outline",
								size: "sm",
							})}
						>
							Show all
						</Link>
						<Link
							to="/app/chat/setup"
							className={buttonVariants({
								size: "icon-sm",
								variant: "outline",
							})}
						>
							<PlusIcon />
						</Link>
					</SectionAction>
				</SectionHeader>
				<SectionContent>
					<ChatsList limit={6} />
				</SectionContent>
			</Section>

			<Suspense fallback={<BotsShowcaseSkeleton />}>
				<BotsShowcase limit={6} />
			</Suspense>
		</div>
	);
};

export { UserHome };
