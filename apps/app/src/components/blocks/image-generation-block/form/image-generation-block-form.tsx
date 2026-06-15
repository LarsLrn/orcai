import type { ImageGenerationBlock } from "@orcai/schema";
import { useStore } from "@tanstack/react-form";
import { skipToken, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import type { Content } from "@tiptap/react";
import { PublicationStatusField } from "@/components/blocks/form/publication-status-field";
import { BlockEditor } from "@/components/editor/block-editor";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useAppForm } from "@/hooks/form";
import {
	useCreateBlockMutation,
	useUpdateBlockMutation,
} from "@/hooks/mutations/use-block-mutations";
import { orpc } from "@/lib/orpc/orpc";
import { imageGenerationBlockFormOptions } from "./image-generation-block-form-options";

const ImageGenerationBlockForm = ({
	action,
	block,
}: {
	action: "create" | "update";
	block?: ImageGenerationBlock;
}) => {
	const { mutate: createBlock } = useCreateBlockMutation();
	const { mutate: updateBlock } = useUpdateBlockMutation();

	const { auth } = useRouteContext({
		from: "/app",
	});

	const { data: providers } = useSuspenseQuery(
		orpc.provider.list.queryOptions({
			input: {
				organizationId: auth.session.activeOrganizationId,
			},
		}),
	);

	const form = useAppForm({
		...imageGenerationBlockFormOptions(block),
		onSubmit: ({ value }) => {
			if (action === "update" && block) {
				updateBlock({
					...value,
					id: block.id,
				});
			} else {
				createBlock(value);
			}
		},
	});

	const providerId = useStore(
		form.store,
		(state) => state.values.config.provider,
	);
	const contentJson = useStore(form.store, (state) => state.values.contentJson);
	const status = useStore(form.store, (state) => state.values.status);

	const { data: models } = useQuery(
		orpc.model.list.queryOptions({
			input: providerId
				? {
						providerId,
						capabilities: [
							"image-generation",
						],
					}
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

			<div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
				<Card className="lg:col-span-2">
					<CardContent className="flex flex-col gap-4 p-6">
						<form.AppField
							name="name"
							children={(field) => (
								<field.TextField label="Name" placeholder="Block name" />
							)}
						/>
						<form.AppField
							name="description"
							children={(field) => (
								<field.TextareaField
									label="Short Description"
									placeholder="Describe the purpose of this image generation block."
									rows={4}
								/>
							)}
						/>
						<PublicationStatusField
							value={status}
							onChange={(nextStatus) =>
								form.setFieldValue("status", nextStatus)
							}
						/>
					</CardContent>
				</Card>
				<Card className="h-fit">
					<CardHeader>
						<CardTitle>Block AI Settings</CardTitle>
					</CardHeader>
					<CardContent className="flex flex-col gap-4">
						<form.AppField
							name="config.provider"
							listeners={{
								onChange: () => form.setFieldValue("config.model", ""),
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
							name="config.model"
							children={(field) => (
								<field.SelectField
									label="Image Model"
									placeholder="Choose an Image Model"
									options={models?.data?.map((model) => ({
										value: model.id,
										label: model.name,
									}))}
								/>
							)}
						/>

						<form.AppField
							name="config.prompt"
							children={(field) => (
								<field.TextareaField
									label="Guidance Prompt"
									placeholder="All images should be in the style of Van Gogh."
									description="This prompt is prepended to the image generation requests to guide the AI model."
								/>
							)}
						/>
					</CardContent>
				</Card>
			</div>
			<Card>
				<CardHeader>
					<CardTitle>Block Description</CardTitle>
					<CardDescription>
						Optional rich text context for teammates maintaining this block.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<BlockEditor
						content={contentJson ? (contentJson as Content) : undefined}
						onUpdate={(blockEditor) => {
							form.setFieldValue(
								"contentJson",
								blockEditor.getJSON() as ImageGenerationBlock["contentJson"],
							);
							form.setFieldValue("contentHtml", blockEditor.getHTML());
						}}
					/>
				</CardContent>
			</Card>
			<form.AppForm>
				<form.SubmitButton label="Save Block" />
			</form.AppForm>
		</form>
	);
};

export { ImageGenerationBlockForm };
