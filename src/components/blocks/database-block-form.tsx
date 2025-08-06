import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormInputField } from "@/components/forms/fields/form-input-field";
import { FormSelectField } from "@/components/forms/fields/form-select-field";
import { FormValidationErrors } from "@/components/forms/fields/form-validation-errors";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import {
	type BlockInsert,
	blockInsertSchema,
	type DatabaseBlock,
} from "@/lib/orpc/schemas/block";
import { assetQueryOptions } from "@/lib/query-options/asset";
import { blockQueryOptions } from "@/lib/query-options/block";
import { StatePagination } from "./state-pagination";

const DatabaseBlockForm = ({ block }: { block?: DatabaseBlock }) => {
	const router = useRouter();
	const queryClient = useQueryClient();

	const { mutateAsync: updateBlock } = useMutation(
		blockQueryOptions.update(queryClient),
	);
	const { mutateAsync: createBlock } = useMutation(
		blockQueryOptions.create(queryClient),
	);

	const [page, setPage] = useState<number>(0);

	const { data: assets, status: assetsStatus } = useQuery(
		assetQueryOptions.list({
			input: { pageIndex: page, pageSize: 1 },
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
			},
			assets: [],
		},
	});

	const onSubmit = (values: Extract<BlockInsert, { type: "database" }>) => {
		if (block) {
			toast.promise(
				updateBlock({
					...values,
					type: "database",
					id: block.id,
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
								name="config.embeddingModel"
								options={[
									{
										value: "e5-mistral-7b-instruct",
										label: "E5 Mistral 7B Instruct",
									},
									{
										value: "multilingual-e5-large-instruct",
										label: "Multilingual E5 Large Instruct",
									},
									{
										value: "qwen3-embedding-4b",
										label: "Qwen3 Embedding 4B",
									},
								]}
								label="Embedding Model"
								placeholder="Choose an Embedding Model"
								required={true}
							/>
						</CardContent>
					</Card>

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
							maxPages={Math.ceil(assets.rowCount / 1)}
							page={page}
							onPageChange={setPage}
						/>
					)}
				</div>
				<Button type="submit">Save Block</Button>
			</form>
		</Form>
	);
};

export { DatabaseBlockForm };
