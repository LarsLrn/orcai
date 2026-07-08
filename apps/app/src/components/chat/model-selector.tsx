import type { Model, Provider } from "@orcai/schema";
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
	DialogSelectPagination,
	DialogSelectSearch,
	DialogSelectTrigger,
} from "@/components/ui/composed/dialog-select";
import { orpc } from "@/lib/orpc/orpc";
import { cn } from "@/lib/utils";

const PROVIDER_PLACEHOLDER_VALUE = "__select-provider__";
const MODEL_PAGE_SIZE = 20;

const ModelSelectorButton = ({
	selectedModelId,
	selectedProviderId,
	onSelect,
	variant = "compact",
	className,
}: {
	selectedModelId?: string;
	selectedProviderId?: string;
	onSelect: (model: Model, provider: Provider) => void;
	variant?: "compact" | "full";
	className?: string;
}) => {
	const [modelDialogOpen, setModelDialogOpen] = useState(false);
	const [modelSearch, setModelSearch] = useState("");
	const [modelPage, setModelPage] = useState(0);
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
				},
			},
		}),
	);

	const {
		data: modelsResult,
		isLoading: modelsLoading,
		isFetching: modelsFetching,
	} = useQuery({
		...orpc.model.list.queryOptions({
			input: {
				pageIndex: modelPage,
				pageSize: MODEL_PAGE_SIZE,
				filters: {
					providerId: providerFilterId,
					capabilities: [
						"text",
					],
					search: modelSearch || undefined,
				},
			},
		}),
		enabled: modelDialogOpen && !!providerFilterId,
	});

	const { data: selectedModelData } = useQuery({
		...orpc.model.find.queryOptions({
			input: {
				id: selectedModelId ?? "",
			},
		}),
		enabled: !!selectedModelId,
	});

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
				setModelPage(0);
			}
			return;
		}

		const providerExists = providers.some(
			(provider) => provider.id === providerFilter,
		);

		if (!providerExists) {
			setProviderFilter(providers[0].id);
			setModelSearch("");
			setModelPage(0);
		}
	}, [
		providerFilter,
		providers,
	]);

	const models = providerFilterId ? (modelsResult?.data ?? []) : [];
	const pageCount = providerFilterId
		? Math.ceil((modelsResult?.rowCount ?? 0) / MODEL_PAGE_SIZE)
		: 0;

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

	const triggerLabel = selectedModel?.name ?? "Choose model";

	return (
		<DialogSelect
			value={selectedModelId ?? null}
			onValueChange={(modelId) => {
				const model = models.find((entry) => entry.id === modelId);
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
						? "max-w-60 border-transparent bg-transparent px-2 hover:bg-muted"
						: "w-full justify-between",
					className,
				)}
				placeholder="Choose model..."
				size={variant === "compact" ? "sm" : "default"}
			>
				<span className="truncate">{triggerLabel}</span>
			</DialogSelectTrigger>
			<DialogSelectContent title="Choose a text model">
				<DialogSelectSearch
					value={modelSearch}
					onValueChange={(value) => {
						setModelSearch(value);
						setModelPage(0);
					}}
					placeholder="Search models..."
				/>
				<DialogSelectFilters>
					<DialogSelectFilter
						value={providerFilter}
						onValueChange={(providerId) => {
							setProviderFilter(providerId);
							setModelSearch("");
							setModelPage(0);
						}}
						placeholder="Select a provider"
						options={providerFilterOptions}
					/>
				</DialogSelectFilters>
				<DialogSelectList
					loading={providerFilterId ? modelsLoading || modelsFetching : false}
				>
					{models.map((model) => (
						<DialogSelectItem
							key={model.id}
							value={model.id}
							title={model.name}
							description={
								model.description
									? `${model.provider.name} • ${model.description}`
									: model.provider.name
							}
						/>
					))}
					{!modelsLoading && !modelsFetching && models.length === 0 && (
						<DialogSelectEmpty>
							{providerFilterId
								? "No models found."
								: "No active providers available."}
						</DialogSelectEmpty>
					)}
				</DialogSelectList>
				<DialogSelectPagination
					page={modelPage}
					pageCount={pageCount}
					onPageChange={setModelPage}
				/>
			</DialogSelectContent>
		</DialogSelect>
	);
};

export { ModelSelectorButton };
