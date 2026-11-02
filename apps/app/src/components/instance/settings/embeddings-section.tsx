import type { EmbeddingSettings } from "@orcai/schema";
import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
import { TriangleAlertIcon } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { z } from "zod/v4";
import { FormSection } from "@/components/forms/form-layout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/dialog/confirm-dialog";
import { useAppForm } from "@/hooks/form";
import { describeError, errorReasonOf } from "@/lib/errors/describe-error";
import { orpc } from "@/lib/orpc/orpc";
import { formatCount } from "@/lib/presentation/format-number";
import { m } from "@/paraglide/messages";

const embeddingsFormSchema = (keyStored: boolean) =>
	z.object({
		baseUrl: z.url(),
		apiKey: keyStored ? z.string() : z.string().trim().min(1),
		model: z.string().trim().min(1),
	});

/**
 * The endpoint the instance embeds with; saving runs a test embedding first.
 * Another model asks first, since it re-embeds the `files` of every repository.
 */
export const EmbeddingsSection = ({
	embeddings,
	files,
}: {
	embeddings: EmbeddingSettings | null;
	files: number;
}) => {
	const modelListId = useId();
	const [models, setModels] = useState<readonly string[] | null>(null);
	const [failure, setFailure] = useState<string | null>(null);
	const discover = useMutation(
		orpc.instanceSettings.discoverEmbeddingModels.mutationOptions(),
	);
	const save = useMutation(
		orpc.instanceSettings.updateEmbeddings.mutationOptions(),
	);
	const confirm = useConfirm();

	const form = useAppForm({
		defaultValues: {
			baseUrl: embeddings?.baseUrl ?? "",
			apiKey: "",
			model: embeddings?.model ?? "",
		},
		validators: {
			onChange: embeddingsFormSchema(embeddings !== null),
		},
		onSubmit: async ({ value, formApi }) => {
			setFailure(null);
			const saveWith = async (reembedGeneration?: number) => {
				await save.mutateAsync({
					baseUrl: value.baseUrl,
					apiKey: value.apiKey,
					model: value.model,
					reembedGeneration,
				});
				formApi.setFieldValue("apiKey", "");
				toast.success(m.instance_settings_embeddings_saved_toast());
			};
			try {
				try {
					await saveWith();
				} catch (error) {
					// The server knows the dimensions, so it decides whether the model changes.
					if (
						errorReasonOf(error)?.reason !==
						"EMBEDDING_MODEL_CHANGE_UNCONFIRMED"
					) {
						throw error;
					}
					const confirmed = await confirm({
						title: m.instance_settings_embeddings_model_change_confirm_title(),
						description:
							m.instance_settings_embeddings_model_change_confirm_description({
								count: files,
								model: value.model,
							}),
						confirmText:
							m.instance_settings_embeddings_model_change_confirm_button(),
					});
					// The confirmation is for the generation this page shows.
					if (confirmed) await saveWith(embeddings?.generation);
				}
			} catch (error) {
				setFailure(describeError(error));
			}
		},
	});
	const connection = useSelector(form.store, (state) => ({
		baseUrl: state.values.baseUrl,
		apiKey: state.values.apiKey,
	}));

	const loadModels = async () => {
		setFailure(null);
		try {
			const { data } = await discover.mutateAsync(connection);
			setModels(data.listed ? data.models : []);
		} catch (error) {
			setFailure(describeError(error));
		}
	};

	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				form.handleSubmit();
			}}
		>
			<FormSection
				title={m.instance_settings_embeddings_title()}
				description={m.instance_settings_embeddings_description()}
			>
				{embeddings === null && (
					<Alert>
						<TriangleAlertIcon />
						<AlertTitle>
							{m.instance_settings_embeddings_unset_title()}
						</AlertTitle>
						<AlertDescription>
							<p>{m.instance_settings_embeddings_unset_description()}</p>
							<Link
								to="/app"
								className={buttonVariants({
									variant: "outline",
									size: "sm",
								})}
							>
								{m.instance_settings_embeddings_later_action()}
							</Link>
						</AlertDescription>
					</Alert>
				)}

				<form.AppField
					name="baseUrl"
					children={(field) => (
						<field.TextField
							label={m.instance_settings_embeddings_base_url_label()}
							description={m.instance_settings_embeddings_base_url_description()}
							placeholder="https://api.example.com/v1"
							inputMode="url"
							className="font-mono"
						/>
					)}
				/>

				<form.AppField
					name="apiKey"
					children={(field) => (
						<field.PasswordField
							label={m.instance_settings_embeddings_api_key_label()}
							description={
								embeddings
									? m.instance_settings_embeddings_api_key_stored_description()
									: m.instance_settings_embeddings_api_key_description()
							}
							width="medium"
						/>
					)}
				/>

				<div className="flex flex-col gap-2">
					<form.AppField
						name="model"
						children={(field) => (
							<field.TextField
								label={m.instance_settings_embeddings_model_label()}
								description={
									models !== null && models.length === 0
										? m.instance_settings_embeddings_model_unlisted_description()
										: m.instance_settings_embeddings_model_description()
								}
								list={modelListId}
								autoComplete="off"
								className="font-mono"
								width="medium"
							/>
						)}
					/>
					<datalist id={modelListId}>
						{models?.map((model) => (
							<option key={model} value={model} />
						))}
					</datalist>
					<div>
						<Button
							type="button"
							variant="outline"
							size="sm"
							loading={discover.isPending}
							disabled={!connection.baseUrl}
							onClick={() => void loadModels()}
						>
							{m.instance_settings_embeddings_load_models_button()}
						</Button>
					</div>
				</div>

				{embeddings && (
					<p className="text-muted-foreground text-sm">
						{m.instance_settings_embeddings_dimensions_note({
							dimensions: formatCount(embeddings.dimensions),
						})}
					</p>
				)}

				{failure && (
					<Alert variant="destructive" aria-live="polite">
						<AlertTitle>
							{m.instance_settings_embeddings_failed_title()}
						</AlertTitle>
						<AlertDescription>{failure}</AlertDescription>
					</Alert>
				)}

				<div className="flex justify-end">
					<form.AppForm>
						<form.SubmitButton
							label={m.instance_settings_embeddings_save_button()}
						/>
					</form.AppForm>
				</div>
			</FormSection>
		</form>
	);
};
