import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import {
	BotIcon,
	Code2Icon,
	CopyIcon,
	EditIcon,
	GitForkIcon,
	MoreVerticalIcon,
	Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/dialog/confirm-dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUmami } from "@/hooks/use-umami";
import { orpc } from "@/lib/orpc/orpc";
import type { Bot } from "@/lib/orpc/schemas/bot";

const BotHeader = ({ bot }: { bot: Bot }) => {
	const params = useParams({ strict: false });
	const navigate = useNavigate();
	const confirm = useConfirm();
	const { trackEvent } = useUmami();

	const { mutateAsync: deleteChat } = useMutation(
		orpc.bot.delete.mutationOptions(),
	);

	const onDelete = async (e: React.MouseEvent<HTMLDivElement>) => {
		e.stopPropagation();

		const isConfirmed = await confirm({
			title: "Delete Bot",
			description: (
				<>
					<p>Are you sure you want to delete this bot?</p>
					<p className="font-bold">This action cannot be undone.</p>
				</>
			),
			confirmText: "Delete",
			cancelText: "Cancel",
		});

		if (isConfirmed) {
			// We need to navigate away from the bot before it's deleted to avoid
			// refetching the deleted bot. This is not critical, but avoids a backend error.
			if (params.botId && params.botId === bot.id) {
				navigate({ to: "/app/bots" });
			}

			toast.promise(deleteChat({ refs: [{ id: bot.id }] }), {
				loading: "Deleting bot...",
				success: () => {
					trackEvent("bot-delete", {
						botId: bot.id,
					});

					return "Bot deleted";
				},
				error: (error) => ({
					message: "Failed to delete bot",
					description: error.message,
				}),
			});
		}
	};

	return (
		<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
			<div className="space-y-2">
				<div className="flex items-center gap-3">
					<div className="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
						<BotIcon className="size-6" />
					</div>
					<div>
						<h1 className="font-bold text-2xl tracking-tight">{bot.name}</h1>
						<p className="text-muted-foreground text-sm">
							Version {bot.version} • Bot ID: {bot.id.slice(0, 8)}...
						</p>
					</div>
				</div>
				{bot.description && (
					<p className="max-w-2xl text-muted-foreground">{bot.description}</p>
				)}
			</div>

			<div className="flex items-center gap-2">
				<Button variant="outline" className="gap-2">
					<CopyIcon className="size-4" />
					Clone
				</Button>
				<Link
					to="/app/bots/$botId/edit"
					params={{ botId: bot.id }}
					className={buttonVariants({ className: "gap-2" })}
				>
					<EditIcon className="size-4" />
					Edit Bot
				</Link>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="icon">
							<MoreVerticalIcon className="size-4" />
							<span className="sr-only">More options</span>
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem>
							<GitForkIcon className="mr-2 size-4" />
							Fork Bot
						</DropdownMenuItem>
						<DropdownMenuItem>
							<Code2Icon className="mr-2 size-4" />
							Export Config
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem variant="destructive" onClick={onDelete}>
							<Trash2Icon className="mr-2 size-4" />
							Delete Bot
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</div>
	);
};

export { BotHeader };
