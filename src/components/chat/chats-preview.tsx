import { Link } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { CardDescription, CardTitle } from "../ui/card";
import { ChatsList } from "./chats-list";

const ChatsPreview = () => {
	return (
		<div className="col-span-3 space-y-4">
			<div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
				<div>
					{/** TODO: Consider centralising ids used by next-step */}
					{/** biome-ignore lint/correctness/useUniqueElementIds: <Required for next-step to work properly> */}
					<CardTitle id="tour-history" className="text-xl">
						Your Recent Conversations
					</CardTitle>
					<CardDescription>
						Pick right back up where you left off.
					</CardDescription>
				</div>
				<div className="flex items-center gap-2">
					<Link
						to={"/app/chat"}
						className={buttonVariants({ variant: "outline", size: "sm" })}
					>
						Show all
					</Link>
					<Link
						to="/app/chat/setup"
						className={buttonVariants({ size: "icon-sm", variant: "outline" })}
					>
						<PlusIcon />
					</Link>
				</div>
			</div>
			<ChatsList limit={6} />
		</div>
	);
};

export { ChatsPreview };
