import { createFileRoute, Link } from "@tanstack/react-router";
import {
	BotIcon,
	MessageSquarePlusIcon,
	SparklesIcon,
	UserIcon,
} from "lucide-react";
import { useState } from "react";
import {
	Page,
	PageContent,
	PageDescription,
	PageFooter,
	PageHeader,
	PageTitle,
} from "@/components/app/page";
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
import { useCreateChat } from "@/hooks/actions/use-create-chat";
import type { Bot } from "@/lib/orpc/schemas/bot";

export const Route = createFileRoute("/app/chat/setup")({
	head: () => ({
		meta: [
			{
				title: "Setup",
			},
		],
	}),
	component: RouteComponent,
});

function RouteComponent() {
	const { createChat } = useCreateChat();
	const [selectedBot, setSelectedBot] = useState<Bot | null>(null);
	const [dialogOpen, setDialogOpen] = useState(false);

	return (
		<Page>
			<PageHeader className="text-center">
				<PageTitle>Start Your Chat</PageTitle>
				<PageDescription>
					Choose how you'd like to begin your conversation
				</PageDescription>
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
									<CardTitle className="text-xl">Use a Bot Template</CardTitle>
									<CardDescription>
										Start with a pre-configured AI assistant designed for
										specific tasks
									</CardDescription>
								</CardHeader>
								<CardContent>
									<div className="space-y-2 text-muted-foreground text-sm">
										<div className="flex items-center gap-2">
											<SparklesIcon className="h-4 w-4" />
											<span>Ready-to-use templates</span>
										</div>
										<div className="flex items-center gap-2">
											<UserIcon className="h-4 w-4" />
											<span>Specialized AI personalities</span>
										</div>
									</div>
								</CardContent>
							</Card>
						}
					/>

					<DialogContent className="flex max-h-[80vh] max-w-2xl flex-col overflow-hidden">
						<DialogHeader>
							<DialogTitle>Select a Bot Template</DialogTitle>
							<DialogDescription>
								Choose from our collection of specialized AI assistants
							</DialogDescription>
						</DialogHeader>

						<BotSelect onBotSelect={setSelectedBot} selectedBot={selectedBot} />

						{/* Action Buttons */}
						<div className="flex justify-end gap-3 border-t pt-4">
							<Button variant="outline" onClick={() => setDialogOpen(false)}>
								Cancel
							</Button>
							<Button
								disabled={!selectedBot}
								onClick={() => createChat(selectedBot?.id)}
							>
								Start Chat
							</Button>
						</div>
					</DialogContent>
				</Dialog>

				{/* Start Fresh Option */}
				<Link to="/app/chat">
					<Card className="group h-full cursor-pointer justify-between transition-shadow hover:shadow-lg">
						<CardHeader className="text-center">
							<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary/10 transition-colors group-hover:bg-secondary/20">
								<MessageSquarePlusIcon className="h-8 w-8 text-primary" />
							</div>
							<CardTitle className="text-xl">Start Fresh</CardTitle>
							<CardDescription>
								Begin with a blank chat and customize as you go
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-2 text-muted-foreground text-sm">
								<div className="flex items-center gap-2">
									<MessageSquarePlusIcon className="h-4 w-4" />
									<span>Complete creative freedom</span>
								</div>
								<div className="flex items-center gap-2">
									<SparklesIcon className="h-4 w-4" />
									<span>Build your own experience</span>
								</div>
							</div>
						</CardContent>
					</Card>
				</Link>
			</PageContent>

			<Separator className="my-2" />

			<PageFooter className="text-center text-muted-foreground text-sm">
				<p>
					Not sure which option to choose? Bot templates are great for specific
					tasks, while starting fresh gives you complete control.
				</p>
			</PageFooter>
		</Page>
	);
}
