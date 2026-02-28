import { useStore } from "@tanstack/react-form";
import { skipToken, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { useState } from "react";
import { StatePagination } from "@/components/blocks/state-pagination";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent } from "@/components/ui/card";
import { useAppForm } from "@/hooks/form";
import {
	useCreateBlockMutation,
	useUpdateBlockMutation,
} from "@/hooks/mutations/use-block-mutations";
import { orpc } from "@/lib/orpc/orpc";
import type { Asset } from "@/lib/orpc/schemas/asset";
import type { DatabaseBlock } from "@/lib/orpc/schemas/block";
import { databaseBlockFormOptions } from "./database-block-form-options";

const DatabaseBlockForm = ({
	action,
	block,
	assetIds,
}: {
	action: "create" | "update";
	block?: DatabaseBlock;
	assetIds?: Asset["id"][];
}) => {
	const { mutate: createBlock } = useCreateBlockMutation();
	const { mutate: updateBlock } = useUpdateBlockMutation();

	const { auth } = useRouteContext({ from: "/app" });

	const { data: providers } = useSuspenseQuery(
		orpc.provider.list.queryOptions({
			input: { organizationId: auth.session.activeOrganizationId },
		}),
	);

	const [page, setPage] = useState<number>(0);

	const { data: assets, status: assetsStatus } = useQuery(
		orpc.asset.list.queryOptions({
			input: { pageIndex: page, pageSize: 20 },
		}),
	);

	const form = useAppForm({
		...databaseBlockFormOptions(block, assetIds),
		onSubmit: ({ value }) => {
			if (action === "update" && block) {
				updateBlock({ ...value, id: block.id });
			} else {
				createBlock(value);
			}
		},
	});

	const providerId = useStore(
		form.store,
		(state) => state.values.config.provider,
	);

	const formAssets = useStore(form.store, (state) => state.values.assets);

	const { data: embeddingModels } = useQuery(
		orpc.model.list.queryOptions({
			input: providerId
				? { providerId, capabilities: ["embedding"] }
				: skipToken,
		}),
	);

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
			className="space-y-4"
			noValidate
		>
			<form.AppForm>
				<form.FormValidationErrors />
			</form.AppForm>

			<div className="flex flex-col gap-4">
				<Card className="lg:col-span-2">
					<CardContent className="flex flex-col gap-4 p-6">
						<form.AppField
							name="name"
							children={(field) => (
								<field.TextField label="Name" placeholder="Block name" />
							)}
						/>

						<form.AppField
							name="config.provider"
							listeners={{
								onChange: () => form.setFieldValue("config.embeddingModel", ""),
							}}
							children={(field) => (
								<field.SelectField
									label="Provider"
									placeholder="Choose a Provider"
									options={providers.data.map((provider) => ({
										value: provider.id,
										label: provider.name,
									}))}
								/>
							)}
						/>

						<form.AppField
							name="config.embeddingModel"
							children={(field) => (
								<field.SelectField
									label="Embedding Model"
									placeholder="Choose an Embedding Model"
									options={embeddingModels?.data?.map((embeddingModel) => ({
										value: embeddingModel.id,
										label: embeddingModel.name,
									}))}
								/>
							)}
						/>

						<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
							<form.AppField
								name="config.minReferences"
								children={(field) => (
									<field.TextField
										type="number"
										label="Minimum References"
										placeholder="1"
									/>
								)}
							/>

							<form.AppField
								name="config.maxReferences"
								children={(field) => (
									<field.TextField
										type="number"
										label="Maximum References"
										placeholder="10"
									/>
								)}
							/>

							<form.AppField
								name="config.defaultReferences"
								children={(field) => (
									<field.TextField
										type="number"
										label="Default References"
										placeholder="5"
									/>
								)}
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
															form.setFieldValue(
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
															form.setFieldValue("assets", [
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
			<form.AppForm>
				<form.SubmitButton label="Save block" />
			</form.AppForm>
		</form>
	);
};

export { DatabaseBlockForm };
