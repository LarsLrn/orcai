import type { BotId, ModelId, ProviderId } from "@orcai/core";
import type {
	BotSetup,
	BotSetupStrength,
	GenerationSettings,
	Model,
	Provider,
} from "@orcai/schema";
import { skipToken, useQuery } from "@tanstack/react-query";
import { useSelector } from "@tanstack/react-store";
import { type Ref, useImperativeHandle } from "react";
import { BotSetupCoverage } from "@/components/bot/setup/bot-setup-coverage";
import {
	GENERATION_SETTINGS_FIELDS,
	GenerationSettingsFieldGroup,
} from "@/components/chat/form/generation-settings-field-group";
import { ModelSelectorButton } from "@/components/chat/model-selector";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { OptionPicker } from "@/components/ui/composed/option-picker";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppForm } from "@/hooks/form";
import { useSaveBotSetupMutation } from "@/hooks/mutations/use-bot-mutations";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

type SetupFormValues = GenerationSettings & {
	modelId: ModelId | undefined;
	providerId: ProviderId | undefined;
	strength: BotSetupStrength;
};

const strengthOptions = () =>
	[
		{
			value: "recommended",
			label: m.bot_setup_strength_recommended_label(),
			description: m.bot_setup_strength_recommended_description(),
		},
		{
			value: "required",
			label: m.bot_setup_strength_required_label(),
			description: m.bot_setup_strength_required_description(),
		},
	] as const;

const formValues = (setup: BotSetup | null): SetupFormValues => ({
	modelId: setup?.model?.id,
	providerId: setup?.model?.providerId,
	strength: setup?.strength ?? "recommended",
	...setup?.generation,
});

/** Lets the wizard save the step before leaving it, as it does its own steps. */
type BotModelStepHandle = {
	isDirty: () => boolean;
	/** Saves unsaved changes; false when saving failed. */
	save: () => Promise<boolean>;
};

/**
 * The bot's model in the active organisation, with its strength and
 * generation settings, saved through its own procedure. Skipping it leaves
 * the bot's chats free to pick a model.
 */
const BotModelStep = ({
	botId,
	ref,
}: {
	botId: BotId | undefined;
	ref?: Ref<BotModelStepHandle>;
}) => {
	const { data: found } = useQuery(
		orpc.botSetup.find.queryOptions({
			input: botId
				? {
						botId,
					}
				: skipToken,
		}),
	);

	if (!botId) {
		return (
			<Card className="min-w-0 rounded-2xl">
				<CardHeader>
					<CardTitle>{m.bot_setup_title()}</CardTitle>
					<CardDescription>{m.bot_setup_unsaved_description()}</CardDescription>
				</CardHeader>
			</Card>
		);
	}

	if (!found) {
		return <Skeleton className="h-64 w-full rounded-2xl" />;
	}

	if (!found.data.canEdit) {
		return (
			<Card className="min-w-0 rounded-2xl">
				<CardHeader>
					<CardTitle>{m.bot_setup_title()}</CardTitle>
					<CardDescription>{m.error_bot_setup_forbidden()}</CardDescription>
				</CardHeader>
			</Card>
		);
	}

	return (
		<BotModelForm
			// A saved setup restarts the form from what was stored.
			key={JSON.stringify(found.data.setup)}
			botId={botId}
			setup={found.data.setup}
			ref={ref}
		/>
	);
};

const BotModelForm = ({
	botId,
	setup,
	ref,
}: {
	botId: BotId;
	setup: BotSetup | null;
	ref?: Ref<BotModelStepHandle>;
}) => {
	const { mutateAsync: saveSetup, isPending } = useSaveBotSetupMutation();
	const submit = async ({
		modelId,
		providerId,
		strength,
		...generation
	}: SetupFormValues) => {
		if (!modelId) return true;
		const result = await saveSetup({
			botId,
			setup: {
				modelId,
				strength,
				generation: Object.fromEntries(
					Object.entries(generation).filter(([, setting]) => setting != null),
				),
			},
		});
		return result.status === "success";
	};
	const form = useAppForm({
		defaultValues: formValues(setup),
		onSubmit: async ({ value }) => {
			await submit(value);
		},
	});
	const isDirty = () =>
		!form.state.isDefaultValue && form.state.values.modelId !== undefined;
	useImperativeHandle(ref, () => ({
		isDirty,
		save: async () => !isDirty() || (await submit(form.state.values)),
	}));
	const modelId = useSelector(form.store, (state) => state.values.modelId);
	const providerId = useSelector(
		form.store,
		(state) => state.values.providerId,
	);
	const strength = useSelector(form.store, (state) => state.values.strength);
	const { data: model } = useQuery(
		orpc.model.find.queryOptions({
			input: modelId
				? {
						id: modelId,
					}
				: skipToken,
		}),
	);

	return (
		<Card className="min-w-0 rounded-2xl">
			<CardHeader>
				<CardTitle>{m.bot_setup_title()}</CardTitle>
				<CardDescription>{m.bot_setup_description()}</CardDescription>
			</CardHeader>
			<CardContent>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						void form.handleSubmit();
					}}
					className="flex flex-col gap-5"
				>
					<div className="flex flex-col gap-2">
						<Label>{m.chat_settings_model_label()}</Label>
						<ModelSelectorButton
							selectedModelId={modelId}
							selectedProviderId={providerId}
							onSelect={(selected: Model, provider: Provider) => {
								form.setFieldValue("modelId", selected.id);
								form.setFieldValue("providerId", provider.id);
							}}
							excludeDeprecated
							variant="full"
						/>
					</div>

					{modelId && (
						<>
							<div className="flex flex-col gap-2">
								<Label>{m.bot_setup_strength_label()}</Label>
								<OptionPicker
									aria-label={m.bot_setup_strength_label()}
									options={strengthOptions()}
									value={strength}
									onChange={(value) => form.setFieldValue("strength", value)}
								/>
							</div>

							<GenerationSettingsFieldGroup
								form={form}
								fields={GENERATION_SETTINGS_FIELDS}
								maxOutputTokens={model?.data.maxOutputTokens ?? null}
							/>

							<BotSetupCoverage botId={botId} modelId={modelId} />
						</>
					)}

					<div className="flex flex-wrap justify-end gap-2">
						{setup && (
							<Button
								type="button"
								variant="outline"
								disabled={isPending}
								onClick={() =>
									void saveSetup({
										botId,
										setup: null,
									})
								}
							>
								{m.bot_setup_remove_action()}
							</Button>
						)}
						<Button type="submit" disabled={!modelId} loading={isPending}>
							{m.bot_setup_save_action()}
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	);
};

export { BotModelStep, type BotModelStepHandle };
