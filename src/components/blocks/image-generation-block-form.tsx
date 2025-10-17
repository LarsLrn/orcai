import { zodResolver } from "@hookform/resolvers/zod";
import {
	skipToken,
	useMutation,
	useQuery,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { useRouteContext, useRouter } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormInputField } from "@/components/forms/fields/form-input-field";
import { FormSelectField } from "@/components/forms/fields/form-select-field";
import { FormTextField } from "@/components/forms/fields/form-text-field";
import { FormValidationErrors } from "@/components/forms/fields/form-validation-errors";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import {
	type BlockInsert,
	blockInsertSchema,
	type ImageGenerationBlock,
} from "@/lib/orpc/schemas/block";
import { blockQueryOptions } from "@/lib/query-options/block";
import { modelQueryOptions } from "@/lib/query-options/model";
import { organizationProviderQueryOptions } from "@/lib/query-options/organization-provider";

const ImageGenerationBlockForm = ({
	block,
}: {
	block?: ImageGenerationBlock;
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

	const form = useForm({
		resolver: zodResolver(blockInsertSchema.def.options[2]),
		defaultValues: {
			type: "imageGeneration",
			name: block?.name ?? "",
			config: {
				prompt: block?.config.prompt ?? "",
				model: block?.config.model ?? "",
				provider: block?.config.provider ?? "",
			},
		},
	});

	const providerSlug = form.watch("config.provider");

	const { data: models, status: modelsStatus } = useQuery(
		modelQueryOptions.list({
			input: providerSlug
				? { providerSlug, capabilities: ["image-generation"] }
				: skipToken,
		}),
	);

	const onSubmit = (
		values: Extract<BlockInsert, { type: "imageGeneration" }>,
	) => {
		if (block) {
			toast.promise(
				updateBlock({
					params: { id: block.id },
					body: {
						...values,
						type: "imageGeneration",
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
	return (
		<Form {...form}>
			<FormValidationErrors form={form} />
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
				<div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
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
						</CardContent>
					</Card>
					<Card className="h-fit">
						<CardHeader>
							<CardTitle>Block AI Settings</CardTitle>
						</CardHeader>
						<CardContent className="flex flex-col gap-4">
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
									form.setValue("config.model", "");
								}}
							/>

							<FormSelectField
								form={form}
								name="config.model"
								options={models?.data?.map((model) => ({
									value: model.slug,
									label: model.name,
								}))}
								label="Model"
								placeholder="Choose an AI Model"
								required={false}
								disabled={!providerSlug || modelsStatus !== "success"}
							/>

							<FormTextField
								form={form}
								name={"config.prompt"}
								rows={10}
								label="Guidance Prompt"
								description="This prompt is prepended to the image generation requests to guide the AI model."
								placeholder="All images should be in the style of Van Gogh."
								required={false}
							/>
						</CardContent>
					</Card>
				</div>
				<Button type="submit">Save Block</Button>
			</form>
		</Form>
	);
};

export { ImageGenerationBlockForm };
