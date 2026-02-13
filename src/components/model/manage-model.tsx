import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { orpc } from "@/lib/orpc/orpc";
import type { Model } from "@/lib/orpc/schemas/model";
import { ModelForm } from "./form/model-form";

const ManageModel = ({ model }: { model: Model }) => {
	const { mutateAsync: deleteProvider } = useMutation(
		orpc.provider.delete.mutationOptions(),
	);

	const handleDeleteModel = (model: Model) => {
		toast.promise(
			deleteProvider({
				refs: [{ id: model.id }],
			}),
			{
				loading: "Deleting model...",
				success: "Model deleted",
				error: (error) => ({
					message: "Failed to delete model",
					description: error.message,
				}),
			},
		);
	};

	return (
		<div className="mt-4 flex flex-col gap-4">
			<ModelForm action="update" model={model} />
			<div className="flex gap-2">
				<Button variant="destructive" onClick={() => handleDeleteModel(model)}>
					Delete Model
				</Button>
			</div>
		</div>
	);
};

export { ManageModel };
