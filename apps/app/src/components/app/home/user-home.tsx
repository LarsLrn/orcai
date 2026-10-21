import { Link, useNavigate } from "@tanstack/react-router";
import { BotIcon, PlusIcon } from "lucide-react";
import { UserWelcome } from "@/components/app/user-welcome";
import { BotsShowcase } from "@/components/bot/bots-showcase";
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
import { m } from "@/paraglide/messages";

const QuickChatSection = () => {
	const navigate = useNavigate();
	const {
		selectedBotId,
		selectedModelId,
		selectedProviderId,
		availability,
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
				<SectionTitle>{m.home_ask_section_title()}</SectionTitle>
				<SectionDescription>
					{m.home_ask_section_description()}
				</SectionDescription>
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
						{m.home_ask_browse_bots_action()}
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
						availability={availability}
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
					<SectionTitle>{m.home_chats_section_title()}</SectionTitle>
					<SectionDescription>
						{m.home_chats_section_description()}
					</SectionDescription>
					<SectionAction>
						<Link
							to={"/app/chat"}
							className={buttonVariants({
								variant: "outline",
								size: "sm",
							})}
						>
							{m.common_show_all_action()}
						</Link>
						<Link
							to="/app/chat/setup"
							aria-label={m.home_chats_new_chat_aria_label()}
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

			<BotsShowcase limit={6} />
		</div>
	);
};

export { UserHome };
