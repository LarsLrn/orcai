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
import { orpc } from "@/lib/orpc/orpc";

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
			const discoveredModels = await discoverModels({ providerId });
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
				message:
					error instanceof Error ? error.message : "Failed to discover models",
			});
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={handleOpenChange}>
			<DialogTrigger
				render={<Button variant="outline">Discover Models</Button>}
			/>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Discover Models</DialogTitle>
					<DialogDescription>
						Choose a provider and discover available models automatically.
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-4">
					<Field orientation="vertical">
						<FieldContent>
							<FieldLabel htmlFor={providerSelectId}>Provider</FieldLabel>
							<FieldDescription>
								Select the provider to discover models from.
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
										)?.name ?? "Select a provider"
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
							<AlertTitle>No providers available</AlertTitle>
							<AlertDescription>
								Create a provider first, then run model discovery.
							</AlertDescription>
						</Alert>
					)}

					{result?.status === "success" && (
						<Alert>
							<AlertTitle>Discovery completed</AlertTitle>
							<AlertDescription>
								Found {result.foundCount} model
								{result.foundCount === 1 ? "" : "s"}. Added {result.addedCount},{" "}
								{result.alreadyExistedCount} already existed.
							</AlertDescription>
						</Alert>
					)}

					{result?.status === "error" && (
						<Alert variant="destructive">
							<AlertTitle>Discovery failed</AlertTitle>
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
						Cancel
					</Button>
					<Button
						onClick={handleDiscoverModels}
						disabled={
							!providerId ||
							isPending ||
							(providers.data?.data.length ?? 0) === 0
						}
					>
						{isPending ? "Discovering..." : "Discover Models"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

export { DiscoverModels };
