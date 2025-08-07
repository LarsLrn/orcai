import { zodResolver } from "@hookform/resolvers/zod";
import {
	skipToken,
	useMutation,
	useQuery,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { useRouteContext, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormInputField } from "@/components/forms/fields/form-input-field";
import { FormSelectField } from "@/components/forms/fields/form-select-field";
import { FormValidationErrors } from "@/components/forms/fields/form-validation-errors";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import type { Asset } from "@/lib/orpc/schemas/asset";
import {
	type BlockInsert,
	blockInsertSchema,
	type DatabaseBlock,
} from "@/lib/orpc/schemas/block";
import { assetQueryOptions } from "@/lib/query-options/asset";
import { blockQueryOptions } from "@/lib/query-options/block";
import { modelQueryOptions } from "@/lib/query-options/model";
import { organizationProviderQueryOptions } from "@/lib/query-options/organization-provider";
import { StatePagination } from "./state-pagination";

const DatabaseBlockForm = ({
	block,
	assetIds,
}: {
	block?: DatabaseBlock;
	assetIds?: Asset["id"][];
}) => {
	const router = useRouter();
	const queryClient = useQueryClient();
	const { auth } = useRouteContext({ from: "/app" });

	const { data: providers } = useSuspenseQuery(
		organizationProviderQueryOptions.list({
			input: { organizationId: auth.session.activeOrganizationId },
		}),
	);

	const { mutateAsync: updateBlock } = useMutation(
		blockQueryOptions.update(queryClient),
	);
	const { mutateAsync: createBlock } = useMutation(
		blockQueryOptions.create(queryClient),
	);

	const [page, setPage] = useState<number>(0);

	const { data: assets, status: assetsStatus } = useQuery(
		assetQueryOptions.list({
			input: { pageIndex: page, pageSize: 20 },
		}),
	);

	const form = useForm<Extract<BlockInsert, { type: "database" }>>({
		resolver: zodResolver(blockInsertSchema.def.options[1]),
		mode: "onChange",
		defaultValues: {
			name: block?.name || "",
			type: "database",
			config: {
				embeddingModel: block?.config.embeddingModel || "",
				maxReferences: block?.config.maxReferences || 10,
				minReferences: block?.config.minReferences || 1,
				defaultReferences: block?.config.defaultReferences || 5,
			},
			assets: assetIds || [],
		},
	});

	const onSubmit = (values: Extract<BlockInsert, { type: "database" }>) => {
		if (block) {
			toast.promise(
				updateBlock({
					params: { id: block.id },
					body: {
						...values,
						type: "database",
						id: block.id,
					},
				}),
				{
					loading: "Updating block...",
					success: () => {
						router.history.back();
						return "Block updated successfully";
					},
					error: (error) => ({
						message: "Failed to update block",
						description: error.message,
					}),
				},
			);
		} else {
			toast.promise(createBlock(values), {
				loading: "Creating block...",
				success: (result) => {
					router.navigate({
						to: "/app/blocks/$blockId",
						params: { blockId: result.data.id },
					});
					return "Block created successfully";
				},
				error: (error) => ({
					message: "Failed to create block",
					description: error.message,
				}),
			});
		}
	};

	const formAssets = form.watch("assets");
	const providerSlug = form.watch("config.provider");

	const { data: embeddingModels, status: modelsStatus } = useQuery(
		modelQueryOptions.list({
			input: providerSlug
				? { providerSlug, capabilities: ["embedding"] }
				: skipToken,
		}),
	);

	return (
		<Form {...form}>
			<FormValidationErrors form={form} />
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
				<div className="flex flex-col gap-4">
					<Card className="lg:col-span-2">
						<CardContent className="flex flex-col gap-4 p-6">
							<FormInputField
								form={form}
								name="name"
								inputType="text"
								placeholder="Block name"
								label="Name"
								required={true}
							/>

							<FormSelectField
								form={form}
								name="config.provider"
								options={providers.data.map((provider) => ({
									value: provider.providerSlug,
									label: provider.providerSlug,
								}))}
								label="Provider"
								placeholder="Choose a Provider"
								required={false}
								onValueChange={() => {
									form.setValue("config.embeddingModel", "");
								}}
							/>

							<FormSelectField
								form={form}
								name="config.embeddingModel"
								options={embeddingModels?.data?.map((embeddingModel) => ({
									value: embeddingModel.slug,
									label: embeddingModel.name,
								}))}
								label="Embedding Model"
								placeholder="Choose an Embedding Model"
								required={true}
								disabled={!providerSlug || modelsStatus !== "success"}
							/>

							<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
								<FormInputField
									form={form}
									name="config.minReferences"
									inputType="number"
									label="Minimum References"
									placeholder="1"
									required={true}
								/>
								<FormInputField
									form={form}
									name="config.maxReferences"
									inputType="number"
									label="Maximum References"
									placeholder="10"
									required={true}
								/>
								<FormInputField
									form={form}
									name="config.defaultReferences"
									inputType="number"
									label="Default References"
									placeholder="5"
									required={true}
								/>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardContent className="p-6">
							<h3 className="mb-4 font-medium text-lg">Assets</h3>
							<div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
								{assetsStatus === "pending" && (
									<div className="text-muted-foreground">Loading assets...</div>
								)}
								{assetsStatus === "success" &&
									assets?.data.map((asset) => (
										<Card key={asset.id} className="w-full">
											<CardContent className="flex flex-col gap-2 p-4">
												<div className="font-medium text-sm">{asset.title}</div>
												<div className="text-muted-foreground text-xs">
													{asset.fileType} - {asset.size} bytes
												</div>
												<CardAction>
													{formAssets?.includes(asset.id) ? (
														<Button
															type="button"
															variant="destructive"
															onClick={() => {
																const currentAssets = formAssets || [];
																form.setValue(
																	"assets",
																	currentAssets.filter((id) => id !== asset.id),
																);
															}}
														>
															Remove Asset
														</Button>
													) : (
														<Button
															type="button"
															variant="default"
															onClick={() => {
																const currentAssets = formAssets || [];
																form.setValue("assets", [
																	...currentAssets,
																	asset.id,
																]);
															}}
														>
															Add Asset
														</Button>
													)}
												</CardAction>
											</CardContent>
										</Card>
									))}
							</div>
							{assetsStatus === "success" && (
								<StatePagination
									maxPages={Math.ceil(assets.rowCount / 20)}
									page={page}
									onPageChange={setPage}
								/>
							)}
						</CardContent>
					</Card>
				</div>
				<Button type="submit">Save Block</Button>
			</form>
		</Form>
	);
};

export { DatabaseBlockForm };
