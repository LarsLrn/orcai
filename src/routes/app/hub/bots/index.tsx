import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BotIcon, EditIcon, PlusIcon, TrashIcon } from "lucide-react";
import { BotCard } from "@/components/bot/bot-card";
import { buttonVariants } from "@/components/ui/button";
import {
	Page,
	PageAction,
	PageContent,
	PageDescription,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { useDeleteBotsMutation } from "@/hooks/mutations/use-bot-mutations";
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

	return (
		<Page>
			<PageHeader>
				<PageTitle>AI Bots</PageTitle>
				<PageDescription className="text-muted-foreground">
					Create and manage your custom AI assistants
				</PageDescription>

				<PageAction>
					<Link
						to="/app/hub/bots/add"
						className={buttonVariants({
							variant: "default",
						})}
					>
						<PlusIcon className="mr-2 h-4 w-4" />
						Create Bot
					</Link>
				</PageAction>
			</PageHeader>

			<PageContent>
				{drafts.data.length > 0 ? (
					<div className="mb-10 space-y-4">
						<div>
							<h2 className="font-semibold text-xl">Drafts</h2>
							<p className="text-muted-foreground text-sm">
								Resume bot setups that have not been published yet.
							</p>
						</div>
						<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
							{drafts.data.map((bot) => (
								<BotCard
									key={bot.id}
									bot={bot}
									actions={{
										primary: {
											linkProps: {
												to: "/app/hub/bots/$botId/setup",
												params: {
													botId: bot.id,
												},
											},
										},
										footer: [
											{
												key: "resume",
												label: "Resume Setup",
												icon: EditIcon,
												variant: "default",
												linkProps: {
													to: "/app/hub/bots/$botId/setup",
													params: {
														botId: bot.id,
													},
												},
											},
										],
										dropdown: [
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
										],
									}}
								/>
							))}
						</div>
					</div>
				) : null}

				{bots.data.length === 0 && drafts.data.length === 0 ? (
					<div className="flex min-h-100 flex-col items-center justify-center space-y-4 text-center">
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
							to="/app/hub/bots/add"
							className={buttonVariants({
								variant: "default",
							})}
						>
							<PlusIcon className="mr-2 h-4 w-4" />
							Create Your First Bot
						</Link>
					</div>
				) : bots.data.length === 0 ? (
					<div className="rounded-2xl border border-dashed p-8 text-center">
						<h2 className="font-semibold text-lg">No published bots yet</h2>
						<p className="mt-2 text-muted-foreground text-sm">
							You already have draft setups in progress. Publish one to make it
							available in chat and the main bot list.
						</p>
					</div>
				) : (
					<div className="space-y-4">
						<div>
							<h2 className="font-semibold text-xl">Published Bots</h2>
							<p className="text-muted-foreground text-sm">
								Bots that are ready to use in chat and sharing flows.
							</p>
						</div>
						<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
							{bots.data.map((bot) => (
								<BotCard key={bot.id} bot={bot} />
							))}
						</div>
					</div>
				)}
			</PageContent>
		</Page>
	);
}
