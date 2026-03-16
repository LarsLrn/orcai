import { Link } from "@tanstack/react-router";
import {
	BotIcon,
	MessageSquarePlusIcon,
	MessagesSquareIcon,
	PlusIcon,
} from "lucide-react";
import { Suspense } from "react";
import { UserWelcome } from "@/components/app/user-welcome";
import {
	BotsShowcase,
	BotsShowcaseSkeleton,
} from "@/components/bot/bots-showcase";
import { ChatsList } from "@/components/chat/chats-list";
import { Button, buttonVariants } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
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
import { useCreateChatMutation } from "@/hooks/mutations/use-chat-mutation";

const UserHomeHero = () => {
	const { mutate: createChat } = useCreateChatMutation();

	return (
		<Hero>
			<HeroWave />
			<HeroInner>
				<HeroContent>
					<UserWelcome />
					<div className="flex flex-wrap items-center gap-2">
						<Button size="lg" className="gap-2" onClick={() => createChat({})}>
							<MessageSquarePlusIcon className="h-4 w-4" />
							Start a chat
						</Button>
						<ButtonGroup>
							<Link
								to="/app/chat/setup"
								data-slot="button"
								className={buttonVariants({
									variant: "outline",
								})}
							>
								<MessagesSquareIcon className="h-4 w-4" />
								Chat options
							</Link>
							<Link
								to="/app/hub/bots"
								data-slot="button"
								className={buttonVariants({
									variant: "outline",
								})}
							>
								<BotIcon className="h-4 w-4" />
								Browse bots
							</Link>
						</ButtonGroup>
					</div>
				</HeroContent>
			</HeroInner>
		</Hero>
	);
};

const UserHome = () => {
	return (
		<div className="space-y-12">
			<UserHomeHero />

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
