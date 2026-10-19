import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { reasonMessageOf } from "@/lib/errors/describe-error";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

/** Copies the chat up to a message into a new chat and opens it. */
export const useBranchChat = () => {
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	return useMutation(
		orpc.chat.branch.mutationOptions({
			onSuccess: async ({ data, draft, meta }) => {
				void queryClient.invalidateQueries({
					queryKey: orpc.chat.key(),
				});

				await navigate({
					to: "/app/chat/$chatId",
					params: {
						chatId: data.id,
					},
					search: {
						zedToken: meta?.zedToken,
					},
					state: {
						draft: draft ?? undefined,
					},
				});
			},
			onError: (error) => {
				toast.error(m.chat_branch_create_failed_toast_error(), {
					description: reasonMessageOf(error),
				});
			},
		}),
	);
};
