import type { Bot } from "@orcai/schema";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	BotIcon,
	MessageSquarePlusIcon,
	SparklesIcon,
	UserIcon,
} from "lucide-react";
import { useState } from "react";
import { BotSelect } from "@/components/bot/bot-select";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
	Page,
	PageContent,
	PageDescription,
	PageFooter,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/chat/setup")({
	head: () => ({
		meta: [
			{
				title: m.chat_setup_page_title(),
			},
		],
	}),
	component: RouteComponent,
});

function RouteComponent() {
	const navigate = useNavigate();
	const [selectedBot, setSelectedBot] = useState<Bot | null>(null);
	const [dialogOpen, setDialogOpen] = useState(false);

	return (
		<Page>
			<PageHeader className="text-center">
				<PageTitle>{m.chat_setup_page_title()}</PageTitle>
				<PageDescription>{m.chat_setup_page_description()}</PageDescription>
			</PageHeader>

			<PageContent className="grid gap-6 md:grid-cols-2">
				{/* Bot Template Option */}
				<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
					<DialogTrigger
						nativeButton={false}
						render={
							<Card className="group cursor-pointer justify-between transition-shadow hover:shadow-lg">
								<CardHeader className="text-center">
									<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 transition-colors group-hover:bg-primary/20">
										<BotIcon className="h-8 w-8 text-primary" />
									</div>
									<CardTitle className="text-xl">
										{m.chat_setup_bot_card_title()}
									</CardTitle>
									<CardDescription>
										{m.chat_setup_bot_card_description()}
									</CardDescription>
								</CardHeader>
								<CardContent>
									<div className="space-y-2 text-muted-foreground text-sm">
										<div className="flex items-center gap-2">
											<SparklesIcon className="h-4 w-4 shrink-0" />
											<span>{m.chat_setup_bot_card_point_ready()}</span>
										</div>
										<div className="flex items-center gap-2">
											<UserIcon className="h-4 w-4 shrink-0" />
											<span>{m.chat_setup_bot_card_point_configured()}</span>
										</div>
									</div>
								</CardContent>
							</Card>
						}
					/>

					<DialogContent className="flex max-h-[80vh] max-w-2xl flex-col">
						<DialogHeader>
							<DialogTitle>{m.chat_setup_bot_dialog_title()}</DialogTitle>
							<DialogDescription>
								{m.chat_setup_bot_dialog_description()}
							</DialogDescription>
						</DialogHeader>

						<BotSelect onBotSelect={setSelectedBot} selectedBot={selectedBot} />

						{/* Action Buttons */}
						<div className="flex justify-end gap-3 border-t pt-4">
							<Button variant="outline" onClick={() => setDialogOpen(false)}>
								{m.common_cancel_button()}
							</Button>
							<Button
								disabled={!selectedBot}
								onClick={() =>
									navigate({
										to: "/app/chat/new",
										search: {
											botId: selectedBot?.id,
										},
									})
								}
							>
								{m.chat_setup_bot_dialog_start_action()}
							</Button>
						</div>
					</DialogContent>
				</Dialog>

				<Card className="group h-full cursor-pointer justify-between transition-shadow hover:shadow-lg">
					<button
						type="button"
						className="contents"
						onClick={() =>
							navigate({
								to: "/app/chat/new",
							})
						}
					>
						<CardHeader className="text-center">
							<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary/10 transition-colors group-hover:bg-secondary/20">
								<MessageSquarePlusIcon className="h-8 w-8 text-primary" />
							</div>
							<CardTitle className="text-xl">
								{m.chat_setup_solo_card_title()}
							</CardTitle>
							<CardDescription>
								{m.chat_setup_solo_card_description()}
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-2 text-muted-foreground text-sm">
								<div className="flex items-center gap-2">
									<MessageSquarePlusIcon className="h-4 w-4 shrink-0" />
									<span>{m.chat_setup_solo_card_point_knowledge()}</span>
								</div>
								<div className="flex items-center gap-2">
									<SparklesIcon className="h-4 w-4 shrink-0" />
									<span>{m.chat_setup_solo_card_point_model()}</span>
								</div>
							</div>
						</CardContent>
					</button>
				</Card>
			</PageContent>

			<Separator className="my-2" />

			<PageFooter className="text-center text-muted-foreground text-sm">
				<p>{m.chat_setup_footer_note()}</p>
			</PageFooter>
		</Page>
	);
}
