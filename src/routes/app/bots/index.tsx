import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BotIcon, EditIcon, EyeIcon, PlusIcon } from "lucide-react";
import { BotPreview } from "@/components/bot/bot-preview";
import { buttonVariants } from "@/components/ui/button";
import { CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/bots/")({
	loader: async ({ context: { queryClient } }) => {
		await queryClient.ensureQueryData(
			orpc.bot.list.queryOptions({
				input: { pageIndex: 0, pageSize: 50 },
			}),
		);
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { data: bots } = useSuspenseQuery(
		orpc.bot.list.queryOptions({
			input: { pageIndex: 0, pageSize: 50 },
		}),
	);

	return (
		<div className="container mx-auto space-y-8">
			{/* Header Section */}
			<div className="flex flex-col space-y-4">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div className="space-y-2">
						<h1 className="font-bold text-3xl tracking-tight md:text-4xl">
							AI Bots
						</h1>
						<p className="text-muted-foreground">
							Create and manage your custom AI assistants
						</p>
					</div>

					<Link
						to="/app/bots/add"
						className={buttonVariants({ variant: "default" })}
					>
						<PlusIcon className="mr-2 h-4 w-4" />
						Create Bot
					</Link>
				</div>

				{/* Stats Summary */}
				<div className="flex gap-4">
					<div className="flex items-center gap-2 text-muted-foreground text-sm">
						<BotIcon className="h-4 w-4" />
						{bots.data.length} bot{bots.data.length !== 1 ? "s" : ""}
					</div>
				</div>
			</div>

			<Separator />

			{/* Bots Grid */}
			{bots.data.length === 0 ? (
				<div className="flex min-h-[400px] flex-col items-center justify-center space-y-4 text-center">
					<div className="rounded-full bg-muted p-4">
						<BotIcon className="h-8 w-8 text-muted-foreground" />
					</div>
					<div className="space-y-2">
						<h3 className="font-semibold text-lg">No bots yet</h3>
						<p className="text-muted-foreground">
							Create your first AI bot to get started
						</p>
					</div>
					<Link
						to="/app/bots/add"
						className={buttonVariants({ variant: "default" })}
					>
						<PlusIcon className="mr-2 h-4 w-4" />
						Create Your First Bot
					</Link>
				</div>
			) : (
				<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
					{bots.data.map((bot) => (
						<BotPreview key={bot.id} bot={bot}>
							<CardFooter className="gap-2 pt-4">
								<Link
									to="/app/bots/$botId"
									params={{ botId: bot.id }}
									className={buttonVariants({
										variant: "outline",
										size: "sm",
										className: "flex-1",
									})}
								>
									<EyeIcon className="mr-2 h-4 w-4" />
									View
								</Link>

								<Link
									to="/app/bots/$botId/edit"
									params={{ botId: bot.id }}
									className={buttonVariants({
										variant: "default",
										size: "sm",
										className: "flex-1",
									})}
								>
									<EditIcon className="mr-2 h-4 w-4" />
									Edit
								</Link>
							</CardFooter>
						</BotPreview>
					))}
				</div>
			)}
		</div>
	);
}
