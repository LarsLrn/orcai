"use client";

import { Slot } from "@radix-ui/react-slot";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { VariantProps } from "class-variance-authority";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { useUmami } from "@/hooks/use-umami";
import type { OrpcOutputs } from "@/lib/orpc/contracts";
import { orpc } from "@/lib/orpc/orpc";
import { cn } from "@/lib/utils";

const NewChatButton = ({
	className,
	variant,
	size,
	asChild = false,
	...props
}: React.ComponentProps<"button"> &
	VariantProps<typeof buttonVariants> & {
		asChild?: boolean;
	}) => {
	const navigate = useNavigate();
	const { setOpenMobile } = useSidebar();
	const { trackEvent } = useUmami();

	const queryClient = useQueryClient();

	const { mutateAsync: createChat } = useMutation(
		orpc.chat.create.mutationOptions({
			onSuccess(newChat) {
				// Cache needs to be updated directly as SpiceDB takes time to propagate changes
				// and the query will return stale data if we wait for the next refetch.
				queryClient.setQueryData(
					orpc.chat.list.key(),
					(oldData: OrpcOutputs["chat"]["list"] | undefined) => {
						if (!oldData) return { data: [newChat.data], rowCount: 1 };
						return {
							data: [newChat.data, ...oldData.data],
							rowCount: oldData.rowCount + 1,
						};
					},
				);

				navigate({
					to: "/app/chat/$chatId",
					params: { chatId: newChat.data.id },
				});
				setOpenMobile(false);
			},
		}),
	);

	const handleNewChat = async () => {
		toast.promise(createChat({}), {
			loading: "Creating new chat...",
			success: (result) => {
				trackEvent("chat-create", { chatId: result.data.id });
				return "New chat created";
			},
			error: (error) => ({
				message: "Failed to create chat",
				description: error.message,
			}),
		});
	};

	const Comp = asChild ? Slot : "button";

	return (
		<Comp
			onClick={handleNewChat}
			data-slot="button"
			className={cn(buttonVariants({ variant, size, className }))}
			{...props}
		/>
	);
};

export { NewChatButton };
