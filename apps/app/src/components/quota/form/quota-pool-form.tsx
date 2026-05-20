import type { QuotaPoolDetail } from "@orcai/schema";
import { useStore } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { AlertCircleIcon } from "lucide-react";
import { useEffect, useMemo } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAppForm } from "@/hooks/form";
import {
	useCreateQuotaPoolMutation,
	useUpdateQuotaPoolMutation,
} from "@/hooks/mutations/use-quota-mutations";
import { orpc } from "@/lib/orpc/orpc";
import {
	PROVIDER_WIDE_MODEL_VALUE,
	quotaPoolFormOptions,
} from "./quota-pool-form-options";

const QuotaPoolForm = ({
	action,
	pool,
}: {
	action: "create" | "update";
	pool?: QuotaPoolDetail;
}) => {
	const createQuotaPool = useCreateQuotaPoolMutation();
	const updateQuotaPool = useUpdateQuotaPoolMutation();
	const form = useAppForm({
		...quotaPoolFormOptions(pool),
		onSubmit: ({ value }) => {
			const providerModelId =
				value.providerModelId === PROVIDER_WIDE_MODEL_VALUE
					? null
					: value.providerModelId;

			if (action === "update" && pool) {
				updateQuotaPool.mutate({
					id: pool.id,
					name: value.name.trim(),
					description: value.description.trim() || null,
					providerModelId,
					periodType: value.periodType,
					budgetAmount: value.budgetAmount,
					priority: value.priority,
					isDefault: value.isDefault,
					isActive: value.isActive,
					groupIds: value.groupIds,
				});
				return;
			}

			createQuotaPool.mutate({
				name: value.name.trim(),
				description: value.description.trim() || null,
				providerId: value.providerId,
				providerModelId,
				periodType: value.periodType,
				budgetAmount: value.budgetAmount,
				priority: value.priority,
				isDefault: value.isDefault,
				isActive: value.isActive,
				groupIds: value.groupIds,
			});
		},
	});

	const providers = useQuery(
		orpc.provider.list.queryOptions({
			input: {
				pageIndex: 0,
				pageSize: 200,
			},
		}),
	);

	const models = useQuery(
		orpc.model.list.queryOptions({
			input: {
				pageIndex: 0,
				pageSize: 500,
			},
		}),
	);

	const groups = useQuery(
		orpc.group.list.queryOptions({
			input: {
				pageIndex: 0,
				pageSize: 200,
			},
		}),
	);

	const defaultGroupId =
		groups.data?.data.find(
			(group) => group.kind === "system" && group.systemKey === "all_members",
		)?.id ?? "";

	const selectedProviderId = useStore(
		form.store,
		(state) => state.values.providerId,
	);
	const selectedProviderModelId = useStore(
		form.store,
		(state) => state.values.providerModelId,
	);
	const selectedGroupIds = useStore(
		form.store,
		(state) => state.values.groupIds,
	);

	const providerOptions = useMemo(
		() =>
			(providers.data?.data ?? []).map((provider) => ({
				value: provider.id,
				label: `${provider.name} (${provider.meteringMode})`,
			})),
		[
			providers.data?.data,
		],
	);

	const providerModelOptions = useMemo(() => {
		if (!selectedProviderId) {
			return [
				{
					value: PROVIDER_WIDE_MODEL_VALUE,
					label: "Provider-wide (all models)",
				},
			];
		}

		const matchingModels = (models.data?.data ?? [])
			.filter((model) => model.providerId === selectedProviderId)
			.map((model) => ({
				value: model.id,
				label: model.name,
			}));

		return [
			{
				value: PROVIDER_WIDE_MODEL_VALUE,
				label: "Provider-wide (all models)",
			},
			...matchingModels,
		];
	}, [
		models.data?.data,
		selectedProviderId,
	]);

	const eligibleGroupOptions = useMemo(
		() =>
			(groups.data?.data ?? []).map((group) => ({
				value: group.id,
				label: group.kind === "system" ? `${group.name} (system)` : group.name,
			})),
		[
			groups.data?.data,
		],
	);

	useEffect(() => {
		if (action !== "create" || !defaultGroupId || selectedGroupIds.length > 0) {
			return;
		}

		form.setFieldValue("groupIds", [
			defaultGroupId,
		]);
	}, [
		action,
		defaultGroupId,
		form,
		selectedGroupIds.length,
	]);

	useEffect(() => {
		const optionValues = new Set(
			providerModelOptions.map((option) => option.value),
		);
		if (!optionValues.has(selectedProviderModelId)) {
			form.setFieldValue("providerModelId", PROVIDER_WIDE_MODEL_VALUE);
		}
	}, [
		form,
		providerModelOptions,
		selectedProviderModelId,
	]);

	const isPending = createQuotaPool.isPending || updateQuotaPool.isPending;

	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				form.handleSubmit();
			}}
			className="flex flex-col gap-4"
		>
			<div className="grid gap-4 md:grid-cols-2">
				<form.AppField
					name="name"
					children={(field) => (
						<field.TextField
							label="Name"
							description="Visible for users as the pool they are using."
							placeholder="e.g. OpenAI shared monthly pool"
						/>
					)}
				/>
				<form.AppField
					name="providerId"
					children={(field) => (
						<field.SelectField
							label="Provider"
							placeholder="Select provider"
							description="All quota resolution and metering mode derive from this provider."
							options={providerOptions}
							disabled={action === "update"}
						/>
					)}
				/>
			</div>

			<form.AppField
				name="description"
				children={(field) => (
					<field.TextareaField
						label="Description"
						placeholder="Optional internal notes"
					/>
				)}
			/>

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<form.AppField
					name="providerModelId"
					children={(field) => (
						<field.SelectField
							label="Model Scope"
							placeholder="Select model scope"
							description="Choose a specific model to make this pool model-specific, or keep it provider-wide."
							options={providerModelOptions}
						/>
					)}
				/>
				<form.AppField
					name="periodType"
					children={(field) => (
						<field.SelectField
							label="Period"
							placeholder="Select reset period"
							description="Quota resets at UTC boundaries: weekly (Mon 00:00), monthly (1st), yearly (Jan 1)."
							options={[
								{
									value: "weekly",
									label: "Weekly",
								},
								{
									value: "monthly",
									label: "Monthly",
								},
								{
									value: "yearly",
									label: "Yearly",
								},
							]}
						/>
					)}
				/>
				<form.AppField
					name="budgetAmount"
					children={(field) => (
						<field.TextField
							label="Budget"
							type="number"
							min={1}
							description="Maximum requests or tokens for the current period."
						/>
					)}
				/>
				<form.AppField
					name="priority"
					children={(field) => (
						<field.TextField
							label="Priority"
							type="number"
							description="Higher value wins when multiple candidates have the same specificity."
						/>
					)}
				/>
			</div>

			<div className="grid gap-4 md:grid-cols-2">
				<form.AppField
					name="isDefault"
					children={(field) => (
						<field.SwitchField
							label="Default Pool"
							description="Marks this as the provider-wide default candidate when no higher-priority match exists."
						/>
					)}
				/>
				<form.AppField
					name="isActive"
					children={(field) => (
						<field.SwitchField
							label="Active"
							description="Inactive pools block new reservations but still allow in-flight finalize/release."
						/>
					)}
				/>
			</div>

			<form.AppField
				name="groupIds"
				children={(field) => (
					<field.MultiSelectField
						label="Eligible Groups"
						placeholder="Select one or more groups"
						description="Users can access this pool when they belong to any selected group."
						options={eligibleGroupOptions}
					/>
				)}
			/>

			{action === "create" ? (
				<Alert>
					<AlertCircleIcon className="h-4 w-4" />
					<AlertTitle>Pools cannot be deleted</AlertTitle>
					<AlertDescription>
						After creation, pools can only be deactivated to stop new
						reservations.
					</AlertDescription>
				</Alert>
			) : null}

			<form.AppForm>
				<form.SubmitButton
					label={action === "create" ? "Create Pool" : "Save Changes"}
					disabled={isPending}
				/>
			</form.AppForm>
		</form>
	);
};

export { QuotaPoolForm };
