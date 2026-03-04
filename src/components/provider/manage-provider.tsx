import { Button } from "@/components/ui/button";
import { useDeleteProvidersMutation } from "@/hooks/mutations/use-provider-mutations";
import type { Provider } from "@/lib/orpc/schemas/provider";
import { ProviderForm } from "./form/provider-form";

const ManageProvider = ({ provider }: { provider: Provider }) => {
	const { mutate: deleteProviders } = useDeleteProvidersMutation();

	return (
		<div className="mt-4 flex flex-col gap-4">
			<ProviderForm action="update" provider={provider} />
			<div className="flex gap-2">
				<Button
					variant="destructive"
					onClick={() =>
						deleteProviders({
							refs: [
								{
									id: provider.id,
								},
							],
						})
					}
				>
					Delete Provider
				</Button>
			</div>
		</div>
	);
};

export { ManageProvider };
