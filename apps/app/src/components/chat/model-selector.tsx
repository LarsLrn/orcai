import type { Model, ModelCapability, Provider } from "@orcai/schema";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
	DialogSelect,
	DialogSelectContent,
	DialogSelectEmpty,
	DialogSelectFilter,
	type DialogSelectFilterOption,
	DialogSelectFilters,
	DialogSelectItem,
	DialogSelectList,
	DialogSelectTrigger,
} from "@/components/ui/composed/dialog-select";
import { LoadError } from "@/components/ui/composed/load-error";
import { SearchField } from "@/components/ui/composed/search-field";
import { Pager } from "@/components/ui/pager";
import { usePickerList } from "@/hooks/use-picker-list";
import { orpc } from "@/lib/orpc/orpc";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

const PROVIDER_PLACEHOLDER_VALUE = "__select-provider__";
const MODEL_PAGE_SIZE = 20;
const CHAT_CAPABILITIES: ModelCapability[] = [
	"text",
	"tool-calling",
];

const ModelSelectorButton = ({
	selectedModelId,
	selectedProviderId,
	onSelect,
	capabilities = CHAT_CAPABILITIES,
	variant = "compact",
	disabled,
	className,
	"aria-describedby": describedBy,
}: {
	selectedModelId?: string;
	selectedProviderId?: string;
	onSelect: (model: Model, provider: Provider) => void;
	/** The capabilities every offered model has. */
	capabilities?: ModelCapability[];
	variant?: "compact" | "full";
	disabled?: boolean;
	className?: string;
	"aria-describedby"?: string;
}) => {
	const [modelDialogOpen, setModelDialogOpen] = useState(false);
	const [providerFilter, setProviderFilter] = useState(
		selectedProviderId ?? PROVIDER_PLACEHOLDER_VALUE,
	);

	const providerFilterId =
		providerFilter === PROVIDER_PLACEHOLDER_VALUE ? undefined : providerFilter;

	const { data: providersResult } = useQuery(
		orpc.provider.list.queryOptions({
			input: {
				pageIndex: 0,
				pageSize: 100,
				filters: {
					enabled: true,
					purpose: "models",
				},
			},
		}),
	);

	const models = usePickerList({
		pageSize: MODEL_PAGE_SIZE,
		open: modelDialogOpen,
		queryOptions: ({ search, ...page }) =>
			orpc.model.list.queryOptions({
				input: {
					...page,
					filters: {
						providerId: providerFilterId,
						capabilities,
						isDeprecated: false,
						search,
					},
				},
				enabled: !!providerFilterId,
			}),
	});
	const { setSearch: setModelSearch } = models;

	const { data: selectedModelData } = useQuery(
		orpc.model.find.queryOptions({
			input: {
				id: selectedModelId ?? "",
			},
			enabled: !!selectedModelId,
		}),
	);

	const providers = providersResult?.data ?? [];

	useEffect(() => {
		if (
			!modelDialogOpen &&
			selectedProviderId &&
			providers.some((provider) => provider.id === selectedProviderId) &&
			selectedProviderId !== providerFilter
		) {
			setProviderFilter(selectedProviderId);
		}
	}, [
		modelDialogOpen,
		providerFilter,
		providers,
		selectedProviderId,
	]);

	useEffect(() => {
		if (providers.length === 0) {
			if (providerFilter !== PROVIDER_PLACEHOLDER_VALUE) {
				setProviderFilter(PROVIDER_PLACEHOLDER_VALUE);
				setModelSearch("");
			}
			return;
		}

		const providerExists = providers.some(
			(provider) => provider.id === providerFilter,
		);

		if (!providerExists) {
			setProviderFilter(providers[0].id);
			setModelSearch("");
		}
	}, [
		providerFilter,
		providers,
		setModelSearch,
	]);

	const providerMap = useMemo(
		() =>
			new Map(
				providers.map((p) => [
					p.id,
					p,
				]),
			),
		[
			providers,
		],
	);

	const providerFilterOptions = useMemo<DialogSelectFilterOption[]>(
		() =>
			providers.map((provider) => ({
				label: provider.name,
				value: provider.id,
			})),
		[
			providers,
		],
	);

	const selectedModel = selectedModelData?.data;

	const triggerLabel =
		selectedModel?.name ?? m.chat_model_selector_trigger_fallback_label();

	return (
		<DialogSelect
			value={selectedModelId ?? null}
			onValueChange={(modelId) => {
				const model = models.rows.find((entry) => entry.id === modelId);
				if (!model) return;
				const provider = providerMap.get(model.providerId);
				if (!provider) return;
				onSelect(model, provider);
			}}
			open={modelDialogOpen}
			onOpenChange={setModelDialogOpen}
		>
			<DialogSelectTrigger
				className={cn(
					variant === "compact"
						? "hover:bg-muted max-w-60 border-transparent bg-transparent px-2"
						: "w-full justify-between",
					className,
				)}
				placeholder={m.chat_model_selector_trigger_placeholder()}
				size={variant === "compact" ? "sm" : "default"}
				disabled={disabled}
				aria-describedby={describedBy}
			>
				<span className="truncate">{triggerLabel}</span>
			</DialogSelectTrigger>
			<DialogSelectContent title={m.chat_model_selector_dialog_title()}>
				<SearchField
					value={models.search}
					onValueChange={setModelSearch}
					placeholder={m.chat_model_selector_search_placeholder()}
				/>
				<DialogSelectFilters>
					<DialogSelectFilter
						value={providerFilter}
						onValueChange={(providerId) => {
							setProviderFilter(providerId);
							setModelSearch("");
						}}
						placeholder={m.chat_model_selector_provider_filter_placeholder()}
						options={providerFilterOptions}
					/>
				</DialogSelectFilters>
				<DialogSelectList loading={providerFilterId ? models.loading : false}>
					{models.rows.map((model) => (
						<DialogSelectItem
							key={model.id}
							value={model.id}
							title={model.name}
							description={
								model.description
									? m.chat_model_selector_item_description({
											provider: model.provider.name,
											description: model.description,
										})
									: model.provider.name
							}
						/>
					))}
					{models.list.isError ? (
						<LoadError query={models.list} />
					) : (
						models.rows.length === 0 && (
							<DialogSelectEmpty>
								{providerFilterId
									? m.chat_model_selector_empty_state()
									: m.chat_model_selector_no_provider_empty_state()}
							</DialogSelectEmpty>
						)
					)}
				</DialogSelectList>
				<Pager variant="compact" {...models.pager} />
			</DialogSelectContent>
		</DialogSelect>
	);
};

export { ModelSelectorButton };
