import type { ImageGenerationBlock } from "@orcai/schema";
import { skipToken, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
import type { Content } from "@tiptap/react";
import { useId } from "react";
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
import { m } from "@/paraglide/messages";
import { imageGenerationBlockFormOptions } from "./image-generation-block-form-options";

const ImageGenerationBlockForm = ({
	action,
	block,
}: {
	action: "create" | "update";
	block?: ImageGenerationBlock;
}) => {
	const { mutateAsync: createBlock } = useCreateBlockMutation();
	const navigate = useNavigate();
	const { mutateAsync: updateBlock } = useUpdateBlockMutation({
		onSuccess: (result) =>
			navigate({
				to: "/app/hub/blocks/$blockId",
				params: {
					blockId: result.data.id,
				},
			}),
	});
	const contentTitleId = useId();

	const { data: providers } = useSuspenseQuery(
		orpc.provider.list.queryOptions({
			input: {},
		}),
	);

	const form = useAppForm({
		...imageGenerationBlockFormOptions(block),
		onSubmit: async ({ value }) => {
			if (action === "update" && block) {
				await updateBlock({
					...value,
					id: block.id,
				});
			} else {
				await createBlock(value);
			}
		},
	});

	const providerId = useSelector(
		form.store,
		(state) => state.values.config.provider,
	);
	const contentJson = useSelector(
		form.store,
		(state) => state.values.contentJson,
	);
	const status = useSelector(form.store, (state) => state.values.status);

	const { data: models } = useQuery(
		orpc.model.list.queryOptions({
			input: providerId
				? {
						filters: {
							providerId,
							capabilities: [
								"image-generation",
							],
						},
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
								<field.TextField
									label={m.common_name_label()}
									placeholder={m.blocks_image_generation_form_name_placeholder()}
								/>
							)}
						/>
						<form.AppField
							name="description"
							children={(field) => (
								<field.TextareaField
									label={m.blocks_image_generation_form_description_label()}
									placeholder={m.blocks_image_generation_form_description_placeholder()}
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
						<CardTitle>
							{m.blocks_image_generation_form_ai_settings_title()}
						</CardTitle>
					</CardHeader>
					<CardContent className="flex flex-col gap-4">
						<form.AppField
							name="config.provider"
							listeners={{
								onChange: () => form.setFieldValue("config.model", ""),
							}}
							children={(field) => (
								<field.SelectField
									label={m.blocks_image_generation_form_provider_label()}
									placeholder={m.blocks_image_generation_form_provider_placeholder()}
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
									label={m.blocks_image_generation_form_model_label()}
									placeholder={m.blocks_image_generation_form_model_placeholder()}
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
									label={m.blocks_image_generation_form_prompt_label()}
									placeholder={m.blocks_image_generation_form_prompt_placeholder()}
									description={m.blocks_image_generation_form_prompt_description()}
								/>
							)}
						/>
					</CardContent>
				</Card>
			</div>
			<Card>
				<CardHeader>
					<CardTitle id={contentTitleId}>
						{m.blocks_image_generation_form_content_title()}
					</CardTitle>
					<CardDescription>
						{m.blocks_image_generation_form_content_description()}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<BlockEditor
						labelledBy={contentTitleId}
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
				<form.SubmitButton
					label={m.blocks_image_generation_form_submit_button()}
				/>
			</form.AppForm>
		</form>
	);
};

export { ImageGenerationBlockForm };
