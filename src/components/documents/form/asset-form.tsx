import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppForm } from "@/hooks/form";
import { useUpdateAssetMutation } from "@/hooks/mutations/use-asset-mutations";
import type { Asset } from "@/lib/orpc/schemas/asset";
import { assetFormOptions } from "./asset-form-options";

const AssetForm = ({ asset }: { asset: Asset }) => {
	const { mutate: updateAsset } = useUpdateAssetMutation();

	const form = useAppForm({
		...assetFormOptions(asset),
		onSubmit: ({ value }) => {
			updateAsset({ ...value, id: asset.id });
		},
	});

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
			className="flex flex-col gap-4"
		>
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>Asset Metadata</CardTitle>
					</CardHeader>
					<CardContent className="flex flex-col gap-4">
						<form.AppField
							name="title"
							children={(field) => (
								<field.TextField
									label="Title"
									placeholder="Asset title"
									description="The title of the asset. This will be displayed in the student chat view."
								/>
							)}
						/>
						<form.AppField
							name="metadata.author"
							children={(field) => (
								<field.TextField
									label="Author(s)"
									placeholder="Author 1, Author 2..."
									description="A comma separated list of authors. This will be displayed in the student chat view."
								/>
							)}
						/>

						<form.AppField
							name="metadata.pageRange"
							children={(field) => (
								<field.TextField
									label="Page Range"
									placeholder="12-56"
									description="If the asset is part of a larger work, you can specify the page range here. This will be displayed in the student chat view."
								/>
							)}
						/>

						<form.AppField
							name="metadata.chapterTitle"
							children={(field) => (
								<field.TextField
									label="Chapter Title"
									placeholder="Chapter 1: Introduction"
									description="If the asset is part of a larger work, you can specify the chapter title here. This will be displayed in the student chat view."
								/>
							)}
						/>
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>Reference Settings</CardTitle>
					</CardHeader>
					<CardContent className="flex flex-col gap-4">
						<form.AppField
							name="metadata.citation"
							children={(field) => (
								<field.TextField
									label="Citation"
									placeholder="Citation"
									description="This citation will be displayed in the student chat view when the AI uses this asset."
								/>
							)}
						/>

						<form.AppField
							name="metadata.externalUrl"
							children={(field) => (
								<field.TextField
									label="External URL"
									placeholder="External URL"
									description="This URL will be used to link to an external resource referencing the asset in the student chat view, for example a deep link to your LMS."
								/>
							)}
						/>

						<form.AppField
							name="metadata.relevance"
							children={(field) => (
								<field.SelectField
									label="Relevance"
									placeholder="Select relevance"
									description="Adjusts whether the asset is used more frequently (scored higher) or less frequently (scored lower) in the AI's responses."
									options={[
										{ label: "High", value: "high" },
										{ label: "Medium", value: "medium" },
										{ label: "Low", value: "low" },
									]}
								/>
							)}
						/>

						<form.AppField
							name="metadata.showReference"
							children={(field) => (
								<field.SwitchField
									label="Show Reference"
									description="Include a reference to this asset in the student chat view when the AI uses it. When disabled, the AI can still use information from this asset, but will not display a reference."
								/>
							)}
						/>

						<form.AppField
							name="metadata.mergePages"
							children={(field) => (
								<field.SwitchField
									label="Merge Pages"
									description="If this is disabled, the asset will be split on pages, instead of the AI trying to figure out semantically coherent chunks. Highly recommended for files like Presentations or content that is logically grouped on pages."
								/>
							)}
						/>
					</CardContent>
				</Card>
			</div>
			<form.AppForm>
				<form.SubmitButton label="Save Asset" />
			</form.AppForm>
		</form>
	);
};

export { AssetForm };
