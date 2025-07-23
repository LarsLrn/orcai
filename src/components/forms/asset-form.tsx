import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type z from "zod/v4";
import { FormInputField } from "@/components/forms/fields/form-input-field";
import { FormSelectField } from "@/components/forms/fields/form-select-field";
import { FormSwitchField } from "@/components/forms/fields/form-switch-field";
import { FormTextField } from "@/components/forms/fields/form-text-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import type { Asset } from "@/db/schema/asset";
import { assetUpdateSchema } from "@/lib/orpc/contracts/asset";
import { assetQueryOptions } from "@/lib/query-options/asset";

const AssetForm = ({ asset }: { asset: Asset }) => {
	const router = useRouter();

	const { mutateAsync: updateAsset } = useMutation(assetQueryOptions.update());

	const form = useForm<z.infer<typeof assetUpdateSchema>>({
		resolver: zodResolver(assetUpdateSchema),
		defaultValues: {
			id: asset.id,
			title: asset?.title ?? undefined,
			metadata: {
				citation: asset.metadata?.citation ?? undefined,
				externalUrl: asset.metadata?.externalUrl ?? undefined,
				relevance: asset.metadata?.relevance ?? "medium",
				showReference: asset.metadata?.showReference ?? true,
				pageRange: asset.metadata?.pageRange ?? undefined,
				author: asset.metadata?.author ?? undefined,
				chapterTitle: asset.metadata?.chapterTitle ?? undefined,
				mergePages: asset.metadata?.mergePages ?? true,
			},
		},
	});

	const onSubmit = (values: z.infer<typeof assetUpdateSchema>) => {
		toast.promise(updateAsset({ ...values, id: asset.id }), {
			loading: "Updating asset...",
			success: () => {
				router.history.back();
				return "Asset updated successfully";
			},
			error: (error) => ({
				message: "Failed to update asset",
				description: error.message,
			}),
		});
	};

	return (
		<Form {...form}>
			<form
				onSubmit={form.handleSubmit(onSubmit)}
				className="flex flex-col gap-4"
			>
				<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
					<Card>
						<CardHeader>
							<CardTitle>Asset Metadata</CardTitle>
						</CardHeader>
						<CardContent className="flex flex-col gap-4">
							<FormInputField
								form={form}
								name="title"
								label="Title"
								placeholder="Asset title"
								inputType="text"
								description="The title of the asset. This will be displayed in the student chat view."
							/>
							<FormInputField
								form={form}
								name="metadata.author"
								label="Author(s)"
								placeholder="Author 1, Author 2..."
								inputType="text"
								description="A comma separated list of authors. This will be displayed in the student chat view."
							/>
							<FormInputField
								form={form}
								name="metadata.pageRange"
								label="Page Range (If applicable)"
								placeholder="12-56"
								inputType="text"
								description="If the asset is part of a larger work, you can specify the page range here. This will be displayed in the student chat view."
							/>
							<FormInputField
								form={form}
								name="metadata.chapterTitle"
								label="Chapter Title (If applicable)"
								placeholder="Chapter 1: Introduction"
								inputType="text"
								description="If the asset is a chapter in a book, you can specify the chapter title here. This will be displayed in the student chat view."
							/>
						</CardContent>
					</Card>
					<Card>
						<CardHeader>
							<CardTitle>Reference Settings</CardTitle>
						</CardHeader>
						<CardContent className="flex flex-col gap-4">
							<FormTextField
								form={form}
								name="metadata.citation"
								label="Citation"
								placeholder="Citation"
								description="This citation will be displayed in the student chat view when the AI uses this asset."
							/>
							<FormInputField
								form={form}
								name="metadata.externalUrl"
								label="External URL"
								placeholder="moodle.com/course"
								inputType="text"
								description="This URL will be used to link to an external resource referencing the asset in the student chat view, for example a deep link to your LMS."
							/>
							<FormSelectField
								form={form}
								name="metadata.relevance"
								options={[
									{ label: "High", value: "high" },
									{ label: "Medium", value: "medium" },
									{ label: "Low", value: "low" },
								]}
								placeholder="Select relevance"
								label="Relevance"
								description="Adjusts whether the asset is used more frequently (scored higher) or less frequently (scored lower) in the AI's responses."
							/>
							<FormSwitchField
								form={form}
								name="metadata.showReference"
								label="Show Reference"
								description="Include a reference to this asset in the student chat view when the AI uses it. When disabled, the AI can still use information from this asset, but will not display a reference."
							/>
							<FormSwitchField
								form={form}
								name="metadata.mergePages"
								label="Merge Pages"
								description="If this is disabled, the asset will be split on pages, instead of the AI trying to figure out semantically coherent chunks. Highly recommended for files like Presentations or content that is logically grouped on pages."
							/>
						</CardContent>
					</Card>
				</div>
				<Button type="submit">Save Asset</Button>
			</form>
		</Form>
	);
};

export { AssetForm };
