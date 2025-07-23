import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import {
	BotIcon,
	CalendarIcon,
	EditIcon,
	EyeIcon,
	GitForkIcon,
	PlusIcon,
	UserIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { botQueryOptions } from "@/lib/query-options/bot";

export const Route = createFileRoute("/app/bots/")({
	loader: async ({ context: { queryClient } }) => {
		await queryClient.ensureQueryData(
			botQueryOptions.list({
				input: { pageIndex: 0, pageSize: 50 },
			}),
		);
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { data: bots } = useSuspenseQuery(
		botQueryOptions.list({
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
					<Button asChild>
						<Link to="/app/bots/add">
							<PlusIcon className="mr-2 h-4 w-4" />
							Create Bot
						</Link>
					</Button>
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
					<Button asChild>
						<Link to="/app/bots/add">
							<PlusIcon className="mr-2 h-4 w-4" />
							Create Your First Bot
						</Link>
					</Button>
				</div>
			) : (
				<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
					{bots.data.map((bot) => (
						<Card
							key={bot.id}
							className="flex flex-col transition-all hover:shadow-md"
						>
							<CardHeader className="flex-1">
								<div className="flex items-start justify-between">
									<div className="space-y-1">
										<CardTitle className="line-clamp-1 text-lg">
											{bot.name}
										</CardTitle>
										<div className="flex items-center gap-2">
											<Badge variant="secondary" className="text-xs">
												<UserIcon className="mr-1 h-3 w-3" />v{bot.version}
											</Badge>
											{bot.forkedFromId && (
												<Badge variant="outline" className="text-xs">
													<GitForkIcon className="mr-1 h-3 w-3" />
													Forked
												</Badge>
											)}
										</div>
									</div>
								</div>
								<CardDescription className="line-clamp-2 text-sm">
									{bot.description}
								</CardDescription>
							</CardHeader>

							<CardContent className="flex-1">
								<div className="space-y-3">
									<div className="flex items-center gap-2 text-muted-foreground text-xs">
										<CalendarIcon className="h-3 w-3" />
										Created {format(bot.createdAt ?? "", "MMM dd, yyyy")}
									</div>
									{bot.updatedAt && bot.updatedAt !== bot.createdAt && (
										<div className="flex items-center gap-2 text-muted-foreground text-xs">
											<EditIcon className="h-3 w-3" />
											Updated {format(bot.updatedAt, "MMM dd, yyyy")}
										</div>
									)}
								</div>
							</CardContent>

							<CardFooter className="gap-2 pt-4">
								<Button variant="outline" size="sm" asChild className="flex-1">
									<Link to="/app/bots/$botId" params={{ botId: bot.id }}>
										<EyeIcon className="mr-2 h-4 w-4" />
										View
									</Link>
								</Button>
								<Button variant="default" size="sm" asChild className="flex-1">
									<Link to="/app/bots/$botId/edit" params={{ botId: bot.id }}>
										<EditIcon className="mr-2 h-4 w-4" />
										Edit
									</Link>
								</Button>
							</CardFooter>
						</Card>
					))}
				</div>
			)}
		</div>
	);
}
