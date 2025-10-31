import { Slot } from "@radix-ui/react-slot";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { VariantProps } from "class-variance-authority";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { useUmami } from "@/hooks/use-umami";
import type { Bot } from "@/lib/orpc/schemas/bot";
import { chatQueryOptions } from "@/lib/query-options/chat";
import { cn } from "@/lib/utils";

const NewChatButton = ({
	className,
	variant,
	size,
	asChild = false,
	botId,
	...props
}: React.ComponentProps<"button"> &
	VariantProps<typeof buttonVariants> & {
		asChild?: boolean;
		botId?: Bot["id"];
	}) => {
	const navigate = useNavigate();
	const { setOpenMobile } = useSidebar();
	const { trackEvent } = useUmami();
	const queryClient = useQueryClient();

	const { mutateAsync: createChat } = useMutation(
		chatQueryOptions.create(queryClient),
	);

	const handleNewChat = () => {
		toast.promise(createChat({ botId }), {
			loading: "Creating new chat...",
			success: async (result) => {
				// TODO: This is to avoid spiceDB not updating immediately. Find a better solution
				/* await new Promise((resolve) => setTimeout(resolve, 4000)); */
				await navigate({
					to: "/app/chat/$chatId",
					params: { chatId: result.data.id },
				});
				setOpenMobile(false);
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
