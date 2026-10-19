import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldLabel,
} from "@/components/ui/field";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { describeError } from "@/lib/errors/describe-error";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

type DiscoverResult =
	| {
			status: "success";
			foundCount: number;
			addedCount: number;
			alreadyExistedCount: number;
	  }
	| {
			status: "error";
			message: string;
	  };

const DiscoverModels = () => {
	const providerSelectId = useId();
	const [isOpen, setIsOpen] = useState(false);
	const [providerId, setProviderId] = useState("");
	const [result, setResult] = useState<DiscoverResult | null>(null);

	const providers = useQuery(
		orpc.provider.list.queryOptions({
			input: {
				pageIndex: 0,
				pageSize: 200,
			},
		}),
	);

	const { mutateAsync: discoverModels, isPending } = useMutation(
		orpc.model.discover.mutationOptions(),
	);

	const handleOpenChange = (open: boolean) => {
		setIsOpen(open);
		if (!open) {
			setProviderId("");
			setResult(null);
		}
	};

	const handleDiscoverModels = async () => {
		if (!providerId || isPending) {
			return;
		}

		setResult(null);

		try {
			const discoveredModels = await discoverModels({
				providerId,
			});
			const { foundCount, addedCount, alreadyExistedCount } =
				discoveredModels.data;

			setResult({
				status: "success",
				foundCount,
				addedCount,
				alreadyExistedCount,
			});
		} catch (error) {
			setResult({
				status: "error",
				message: describeError(error),
			});
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={handleOpenChange}>
			<DialogTrigger
				render={
					<Button variant="outline">
						{m.models_discover_trigger_button()}
					</Button>
				}
			/>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{m.models_discover_dialog_title()}</DialogTitle>
					<DialogDescription>
						{m.models_discover_dialog_description()}
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-4">
					<Field orientation="vertical">
						<FieldContent>
							<FieldLabel htmlFor={providerSelectId}>
								{m.common_provider_label()}
							</FieldLabel>
							<FieldDescription>
								{m.models_discover_provider_field_description()}
							</FieldDescription>
						</FieldContent>
						<Select
							value={providerId}
							onValueChange={(value) => {
								if (value) {
									setProviderId(value);
									setResult(null);
								}
							}}
							disabled={isPending || (providers.data?.data.length ?? 0) === 0}
						>
							<SelectTrigger id={providerSelectId} className="w-full">
								<SelectValue>
									{(value) =>
										providers.data?.data.find(
											(provider) => provider.id === value,
										)?.name ?? m.models_discover_provider_placeholder()
									}
								</SelectValue>
							</SelectTrigger>
							<SelectContent>
								{providers.data?.data.map((provider) => (
									<SelectItem key={provider.id} value={provider.id}>
										{provider.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>

					{providers.data?.data.length === 0 && (
						<Alert variant="destructive">
							<AlertTitle>{m.models_discover_no_providers_title()}</AlertTitle>
							<AlertDescription>
								{m.models_discover_no_providers_description()}
							</AlertDescription>
						</Alert>
					)}

					{result?.status === "success" && (
						<Alert>
							<AlertTitle>{m.models_discover_success_title()}</AlertTitle>
							<AlertDescription>
								{m.models_discover_success_description({
									count: result.foundCount,
									addedCount: result.addedCount,
									alreadyExistedCount: result.alreadyExistedCount,
								})}
							</AlertDescription>
						</Alert>
					)}

					{result?.status === "error" && (
						<Alert variant="destructive">
							<AlertTitle>{m.models_discover_error_title()}</AlertTitle>
							<AlertDescription>{result.message}</AlertDescription>
						</Alert>
					)}
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => handleOpenChange(false)}
						disabled={isPending}
					>
						{m.common_cancel_button()}
					</Button>
					<Button
						onClick={handleDiscoverModels}
						loading={isPending}
						disabled={!providerId || (providers.data?.data.length ?? 0) === 0}
					>
						{m.models_discover_trigger_button()}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

export { DiscoverModels };
