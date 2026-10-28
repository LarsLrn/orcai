import type { BotWithCapabilities } from "@orcai/schema";
import { useMutation } from "@tanstack/react-query";
import { StarIcon } from "lucide-react";
import { toast } from "sonner";
import { Toggle } from "@/components/ui/toggle";
import { describeError } from "@/lib/errors/describe-error";
import { orpc } from "@/lib/orpc/orpc";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

/** Lists every favourite of the user on one page. */
const FAVOURITE_BOTS_INPUT = {
	pageIndex: 0,
	pageSize: 1000,
	filters: {
		favourite: true,
	},
};

const BotFavouriteToggle = ({
	bot,
	className,
}: {
	bot: Pick<BotWithCapabilities, "id" | "name" | "isFavourite">;
	className?: string;
}) => {
	const { mutate: setFavourite, isPending } = useMutation(
		orpc.bot.setFavourite.mutationOptions({
			onError: (error) => toast.error(describeError(error)),
		}),
	);

	return (
		<Toggle
			size="sm"
			pressed={bot.isFavourite}
			disabled={isPending}
			onPressedChange={(favourite) =>
				setFavourite({
					id: bot.id,
					favourite,
				})
			}
			aria-label={m.bots_favourite_toggle_label({
				name: bot.name,
			})}
			className={cn(
				"px-2 aria-pressed:bg-transparent aria-pressed:hover:bg-muted",
				className,
			)}
		>
			<StarIcon
				className={cn(
					bot.isFavourite
						? "fill-amber-400 text-amber-500"
						: "text-muted-foreground",
				)}
			/>
		</Toggle>
	);
};

/** The read-only mark of a favourite. */
const BotFavouriteStar = ({ className }: { className?: string }) => (
	<StarIcon
		role="img"
		aria-label={m.bots_favourite_label()}
		className={cn("size-4 fill-amber-400 text-amber-500", className)}
	/>
);

export { BotFavouriteStar, BotFavouriteToggle, FAVOURITE_BOTS_INPUT };
