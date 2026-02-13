import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { orpc } from "@/lib/orpc/orpc";
import type { Provider } from "@/lib/orpc/schemas/provider";
import { ProviderForm } from "./form/provider-form";

const ManageProvider = ({ provider }: { provider: Provider }) => {
	const { mutateAsync: deleteProvider } = useMutation(
		orpc.provider.delete.mutationOptions(),
	);

	const handleDeleteProvider = (provider: Provider) => {
		toast.promise(
			deleteProvider({
				refs: [{ id: provider.id }],
			}),
			{
				loading: "Deleting provider...",
				success: "Provider deleted",
				error: (error) => ({
					message: "Failed to delete provider",
					description: error.message,
				}),
			},
		);
	};

	return (
		<div className="mt-4 flex flex-col gap-4">
			<ProviderForm action="update" provider={provider} />
			<div className="flex gap-2">
				<Button
					variant="destructive"
					onClick={() => handleDeleteProvider(provider)}
				>
					Delete Provider
				</Button>
			</div>
		</div>
	);
};

export { ManageProvider };
