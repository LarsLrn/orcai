import { useMutation } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/dialog/confirm-dialog";
import { orpc } from "@/lib/orpc/orpc";

interface DeleteAssetsParams {
	refs: { id: string }[];
	skipConfirmation?: boolean;
	customMessages?: {
		title?: string;
		description?: string;
		loading?: string;
		success?: string;
		errorMessage?: string;
	};
}

const useDeleteAssets = () => {
	const confirm = useConfirm();

	const { mutateAsync: deleteAssets, isPending } = useMutation(
		orpc.asset.delete.mutationOptions(),
	);

	const handleDelete = useCallback(
		async ({
			refs,
			skipConfirmation = false,
			customMessages,
		}: DeleteAssetsParams) => {
			if (!refs || refs.length === 0) {
				toast.error("No documents selected for deletion");
				return false;
			}

			const isMultiple = refs.length > 1;
			const plural = isMultiple ? "s" : "";
			const these = isMultiple ? "these" : "this";

			const messages = {
				title: customMessages?.title || `Delete Document${plural}`,
				description:
					customMessages?.description ||
					`Are you sure you want to delete ${these} document${plural}? This action cannot be undone.`,
				loading: customMessages?.loading || `Deleting document${plural}...`,
				success:
					customMessages?.success || `Document${plural} deleted successfully`,
				errorMessage:
					customMessages?.errorMessage || `Failed to delete document${plural}`,
			};

			if (!skipConfirmation) {
				const isConfirmed = await confirm({
					title: messages.title,
					description: messages.description,
					confirmText: "Delete",
					cancelText: "Cancel",
				});

				if (!isConfirmed) {
					return false;
				}
			}

			try {
				toast.promise(deleteAssets({ refs }), {
					loading: messages.loading,
					success: messages.success,
					error: (error) => ({
						message: messages.errorMessage,
						description: error.message,
					}),
				});
				return true;
			} catch (error) {
				console.error("Delete operation failed:", error);
				return false;
			}
		},
		[deleteAssets, confirm],
	);

	return {
		deleteAssets: handleDelete,
		isDeleting: isPending,
	};
};

export { useDeleteAssets };
