import { Button } from "@/components/ui/button";
import { useDeleteModelsMutation } from "@/hooks/mutations/use-model-mutations";
import type { Model } from "@/lib/orpc/schemas/model";
import { ModelForm } from "./form/model-form";

const ManageModel = ({ model }: { model: Model }) => {
	const { mutate: deleteModels } = useDeleteModelsMutation();

	return (
		<div className="mt-4 flex flex-col gap-4">
			<ModelForm action="update" model={model} />
			<div className="flex gap-2">
				<Button
					variant="destructive"
					onClick={() =>
						deleteModels({
							refs: [
								{
									id: model.id,
								},
							],
						})
					}
				>
					Delete Model
				</Button>
			</div>
		</div>
	);
};

export { ManageModel };
