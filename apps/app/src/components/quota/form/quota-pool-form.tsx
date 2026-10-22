import type { QuotaPoolDetail } from "@orcai/schema";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
import { AlertCircleIcon } from "lucide-react";
import { useEffect, useMemo } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAppForm } from "@/hooks/form";
import {
	useCreateQuotaPoolMutation,
	useUpdateQuotaPoolMutation,
} from "@/hooks/mutations/use-quota-mutations";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";
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
	const navigate = useNavigate();
	const updateQuotaPool = useUpdateQuotaPoolMutation({
		onSuccess: (result) =>
			navigate({
				to: "/app/quotas/$quotaPoolId",
				params: {
					quotaPoolId: result.data.id,
				},
			}),
	});
	const form = useAppForm({
		...quotaPoolFormOptions(pool),
		onSubmit: async ({ value }) => {
			const modelId =
				value.modelId === PROVIDER_WIDE_MODEL_VALUE ? null : value.modelId;

			if (action === "update" && pool) {
				await updateQuotaPool.mutateAsync({
					id: pool.id,
					name: value.name.trim(),
					description: value.description.trim() || null,
					modelId,
					periodType: value.periodType,
					budgetAmount: value.budgetAmount,
					priority: value.priority,
					isDefault: value.isDefault,
					isActive: value.isActive,
					groupIds: value.groupIds,
				});
				return;
			}

			await createQuotaPool.mutateAsync({
				name: value.name.trim(),
				description: value.description.trim() || null,
				providerId: value.providerId,
				modelId,
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

	const selectedProviderId = useSelector(
		form.store,
		(state) => state.values.providerId,
	);
	const selectedProviderModelId = useSelector(
		form.store,
		(state) => state.values.modelId,
	);
	const selectedGroupIds = useSelector(
		form.store,
		(state) => state.values.groupIds,
	);

	const providerOptions = useMemo(
		() =>
			(providers.data?.data ?? []).map((provider) => ({
				value: provider.id,
				label: m.quotas_form_provider_option_label({
					name: provider.name,
					meteringMode: provider.meteringMode,
				}),
			})),
		[
			providers.data?.data,
		],
	);

	const modelOptions = useMemo(() => {
		if (!selectedProviderId) {
			return [
				{
					value: PROVIDER_WIDE_MODEL_VALUE,
					label: m.quotas_form_model_scope_all_option(),
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
				label: m.quotas_form_model_scope_all_option(),
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
				label:
					group.kind === "system"
						? m.quotas_form_group_system_label({
								name: group.name,
							})
						: group.name,
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
		const optionValues = new Set(modelOptions.map((option) => option.value));
		if (!optionValues.has(selectedProviderModelId)) {
			form.setFieldValue("modelId", PROVIDER_WIDE_MODEL_VALUE);
		}
	}, [
		form,
		modelOptions,
		selectedProviderModelId,
	]);

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
							label={m.common_name_label()}
							description={m.quotas_form_name_description()}
							placeholder={m.quotas_form_name_placeholder()}
						/>
					)}
				/>
				<form.AppField
					name="providerId"
					children={(field) => (
						<field.SelectField
							label={m.common_provider_label()}
							placeholder={m.quotas_form_provider_placeholder()}
							description={m.quotas_form_provider_description()}
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
						label={m.common_description_label()}
						placeholder={m.quotas_form_description_placeholder()}
					/>
				)}
			/>

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<form.AppField
					name="modelId"
					children={(field) => (
						<field.SelectField
							label={m.quotas_form_model_scope_label()}
							placeholder={m.quotas_form_model_scope_placeholder()}
							description={m.quotas_form_model_scope_description()}
							options={modelOptions}
						/>
					)}
				/>
				<form.AppField
					name="periodType"
					children={(field) => (
						<field.SelectField
							label={m.quotas_form_period_label()}
							placeholder={m.quotas_form_period_placeholder()}
							description={m.quotas_form_period_description()}
							options={[
								{
									value: "weekly",
									label: m.quotas_period_weekly_label(),
								},
								{
									value: "monthly",
									label: m.quotas_period_monthly_label(),
								},
								{
									value: "yearly",
									label: m.quotas_period_yearly_label(),
								},
							]}
						/>
					)}
				/>
				<form.AppField
					name="budgetAmount"
					children={(field) => (
						<field.TextField
							label={m.quotas_form_budget_label()}
							type="number"
							min={1}
							description={m.quotas_form_budget_description()}
						/>
					)}
				/>
				<form.AppField
					name="priority"
					children={(field) => (
						<field.TextField
							label={m.quotas_form_priority_label()}
							type="number"
							description={m.quotas_form_priority_description()}
						/>
					)}
				/>
			</div>

			<div className="grid gap-4 md:grid-cols-2">
				<form.AppField
					name="isDefault"
					children={(field) => (
						<field.SwitchField
							label={m.quotas_form_default_label()}
							description={m.quotas_form_default_description()}
						/>
					)}
				/>
				<form.AppField
					name="isActive"
					children={(field) => (
						<field.SwitchField
							label={m.common_status_active_label()}
							description={m.quotas_form_active_description()}
						/>
					)}
				/>
			</div>

			<form.AppField
				name="groupIds"
				children={(field) => (
					<field.MultiSelectField
						label={m.quotas_form_groups_label()}
						placeholder={m.quotas_form_groups_placeholder()}
						description={m.quotas_form_groups_description()}
						options={eligibleGroupOptions}
					/>
				)}
			/>

			{action === "create" ? (
				<Alert>
					<AlertCircleIcon className="h-4 w-4" />
					<AlertTitle>{m.quotas_form_undeletable_alert_title()}</AlertTitle>
					<AlertDescription>
						{m.quotas_form_undeletable_alert_description()}
					</AlertDescription>
				</Alert>
			) : null}

			<form.AppForm>
				<form.SubmitButton
					label={
						action === "create"
							? m.quotas_form_create_button()
							: m.quotas_form_save_changes_button()
					}
				/>
			</form.AppForm>
		</form>
	);
};

export { QuotaPoolForm };
