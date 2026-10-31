import { getProviderPurpose, type ProviderId } from "@orcai/core";
import { listModelsInputSchema } from "@orcai/schema";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import {
	BadgeCheck,
	BadgeX,
	BotIcon,
	BoxIcon,
	CoinsIcon,
	EditIcon,
	GlobeIcon,
	PlusIcon,
	ServerIcon,
	SparklesIcon,
} from "lucide-react";
import type { z } from "zod/v4";
import { MetadataCard } from "@/components/app/metadata-card";
import { DiscoverModels } from "@/components/model/discover-models";
import { ModelTableActions } from "@/components/model/table/model-table-actions";
import { modelTableColumns } from "@/components/model/table/model-table-columns";
import { SearchPoolNotice } from "@/components/provider/search-pool-notice";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableBody } from "@/components/ui/data-table/data-table-body";
import { DataTablePagination } from "@/components/ui/data-table/data-table-pagination";
import { DataTableSearch } from "@/components/ui/data-table/data-table-search";
import {
	dataTableQuerySchema,
	dataTableSearchDefaults,
	paginationSearchShape,
} from "@/components/ui/data-table/data-table-search-params";
import {
	DataTableToolbar,
	DataTableToolbarActions,
} from "@/components/ui/data-table/data-table-toolbar";
import { Separator } from "@/components/ui/separator";
import { HeaderActions } from "@/components/ui/shell/actions";
import {
	Page,
	PageContent,
	PageDescription,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import {
	Section,
	SectionAction,
	SectionDescription,
	SectionHeader,
	SectionTitle,
} from "@/components/ui/shell/section";
import { orpc } from "@/lib/orpc/orpc";
import { formatPrice } from "@/lib/presentation/format-number";
import { getModelCapabilityLabel } from "@/lib/presentation/model-capability";
import { getProviderKindLabel } from "@/lib/presentation/provider-kind";
import {
	getProviderStatusLabel,
	getProviderStatusVariant,
} from "@/lib/presentation/provider-status";
import { m } from "@/paraglide/messages";

const searchSchema = listModelsInputSchema
	.omit({
		filters: true,
	})
	.extend({
		...paginationSearchShape,
		query: dataTableQuerySchema.default(""),
	});

const modelsInput = (
	providerId: ProviderId,
	{ pageIndex, pageSize, sort, query }: z.infer<typeof searchSchema>,
) => ({
	filters: {
		providerId,
		search: query || undefined,
	},
	pageIndex,
	pageSize,
	sort,
});

const providerModelColumns = modelTableColumns.filter(
	(column) => column.id !== "providerName",
);

export const Route = createFileRoute("/app/providers/$providerId/")({
	validateSearch: searchSchema,
	search: {
		middlewares: [
			stripSearchParams(dataTableSearchDefaults),
		],
	},
	loaderDeps: ({ search }) => search,
	loader: async ({
		context: { queryClient },
		params: { providerId },
		deps,
	}) => {
		await queryClient.query(
			orpc.model.list.queryOptions({
				input: modelsInput(providerId, deps),
				staleTime: "static",
			}),
		);
	},
	component: RouteComponent,
});

const getEndpointHost = (endpoint: string | null) => {
	if (endpoint === null) {
		return m.providers_detail_endpoint_default();
	}
	try {
		return new URL(endpoint).host;
	} catch {
		return endpoint;
	}
};

function RouteComponent() {
	const { providerId } = Route.useParams();
	const search = Route.useSearch();
	const { data: providerResponse } = useSuspenseQuery(
		orpc.provider.find.queryOptions({
			input: {
				id: providerId,
			},
		}),
	);

	const { data: models } = useSuspenseQuery(
		orpc.model.list.queryOptions({
			input: modelsInput(providerId, search),
		}),
	);

	const provider = providerResponse.data;
	const activeModelCount = provider.models.total - provider.models.deprecated;
	const supportedCapabilities = provider.models.capabilities.map(
		getModelCapabilityLabel,
	);
	const kindLabel = getProviderKindLabel(provider.kind);
	const servesModels = getProviderPurpose(provider.kind) === "models";
	const endpointHost = getEndpointHost(provider.endpoint);

	return (
		<Page>
			<PageHeader>
				<PageTitle>{provider.name}</PageTitle>
				<PageDescription>{provider.description}</PageDescription>
				<div className="flex flex-wrap gap-2">
					<Badge variant={getProviderStatusVariant(provider.enabled)}>
						{provider.enabled ? (
							<BadgeCheck className="size-3" />
						) : (
							<BadgeX className="size-3" />
						)}
						{getProviderStatusLabel(provider.enabled)}
					</Badge>
					<Badge variant="outline">
						<ServerIcon className="size-3" />
						{kindLabel}
					</Badge>
					{servesModels ? (
						<Badge variant="outline">
							<BotIcon className="size-3" />
							{m.providers_detail_model_count_badge({
								count: provider.models.total,
							})}
						</Badge>
					) : (
						<Badge variant="outline">
							<GlobeIcon className="size-3" />
							{m.providers_detail_search_badge()}
						</Badge>
					)}
				</div>
				<HeaderActions
					actions={[
						{
							key: "edit",
							label: m.providers_detail_edit_button(),
							icon: EditIcon,
							variant: "default",
							linkProps: {
								to: "/app/providers/$providerId/edit",
								params: {
									providerId,
								},
							},
						},
						servesModels && {
							key: "add-model",
							label: m.providers_detail_add_model_button(),
							icon: PlusIcon,
							linkProps: {
								to: "/app/models/add",
							},
						},
					]}
				/>
			</PageHeader>
			<PageContent className="grid grid-cols-1 gap-6 lg:grid-cols-3">
				<div className="space-y-6 lg:col-span-2">
					{!servesModels && <SearchPoolNotice providerId={provider.id} />}
					<Card>
						<CardHeader>
							<CardTitle>{m.providers_detail_overview_title()}</CardTitle>
							<CardDescription>
								{m.providers_detail_overview_description()}
							</CardDescription>
						</CardHeader>
						<CardContent className="@container">
							<div className="grid @2xl:grid-cols-4 @sm:grid-cols-2 gap-4">
								<div>
									<div className="text-muted-foreground text-xs uppercase">
										{m.providers_detail_endpoint_host_label()}
									</div>
									<div className="wrap-anywhere mt-1 font-semibold text-sm">
										{endpointHost}
									</div>
								</div>
								{servesModels && (
									<>
										<div>
											<div className="text-muted-foreground text-xs uppercase">
												{m.providers_detail_active_models_label()}
											</div>
											<div className="mt-1 font-semibold text-sm">
												{activeModelCount}
											</div>
										</div>
										<div>
											<div className="text-muted-foreground text-xs uppercase">
												{m.providers_detail_deprecated_models_label()}
											</div>
											<div className="mt-1 font-semibold text-sm">
												{provider.models.deprecated}
											</div>
										</div>
										<div>
											<div className="text-muted-foreground text-xs uppercase">
												{m.providers_detail_capability_coverage_label()}
											</div>
											<div className="mt-1 font-semibold text-sm">
												{supportedCapabilities.length}
											</div>
										</div>
									</>
								)}
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>{m.providers_detail_configuration_title()}</CardTitle>
							<CardDescription>
								{m.providers_detail_configuration_description()}
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="flex items-start justify-between gap-4">
								<div className="flex items-center gap-2 text-muted-foreground text-sm">
									<ServerIcon className="h-4 w-4" />
									{m.providers_form_kind_label()}
								</div>
								<span className="font-medium">{kindLabel}</span>
							</div>
							<Separator />
							<div className="flex items-start justify-between gap-4">
								<div className="flex items-center gap-2 text-muted-foreground text-sm">
									<ServerIcon className="h-4 w-4" />
									{m.providers_form_endpoint_label()}
								</div>
								{provider.endpoint === null ? (
									<span className="font-medium">
										{m.providers_detail_endpoint_default()}
									</span>
								) : (
									<code className="rounded border bg-muted/40 px-2 py-1 font-mono text-xs">
										{provider.endpoint}
									</code>
								)}
							</div>
							<Separator />
							<div className="flex items-start justify-between gap-4">
								<div className="flex items-center gap-2 text-muted-foreground text-sm">
									<CoinsIcon className="h-4 w-4" />
									{m.providers_form_currency_label()}
								</div>
								<span className="font-medium">
									{provider.currency}
									{provider.reportsCost &&
										` · ${m.providers_detail_reports_cost_label()}`}
								</span>
							</div>
							{!servesModels && (
								<>
									<Separator />
									<div className="flex items-start justify-between gap-4">
										<div className="flex items-center gap-2 text-muted-foreground text-sm">
											<CoinsIcon className="h-4 w-4" />
											{m.providers_form_search_price_label()}
										</div>
										<span className="font-medium tabular-nums">
											{provider.searchPrice === null
												? m.models_detail_price_unset()
												: formatPrice(provider.searchPrice, provider.currency)}
										</span>
									</div>
								</>
							)}
						</CardContent>
					</Card>

					{servesModels && (
						<Card>
							<CardHeader>
								<CardTitle>{m.common_capabilities_title()}</CardTitle>
								<CardDescription>
									{m.providers_detail_capabilities_description()}
								</CardDescription>
							</CardHeader>
							<CardContent>
								{supportedCapabilities.length === 0 ? (
									<p className="text-muted-foreground text-sm">
										{m.providers_detail_no_capabilities_label()}
									</p>
								) : (
									<div className="flex flex-wrap gap-2">
										{supportedCapabilities.map((capability) => (
											<Badge key={capability} variant="outline">
												<SparklesIcon className="h-3 w-3" />
												{capability}
											</Badge>
										))}
									</div>
								)}
							</CardContent>
						</Card>
					)}
				</div>

				<div className="space-y-6">
					<MetadataCard
						id={provider.id}
						createdAt={provider.createdAt}
						updatedAt={provider.updatedAt}
					/>
				</div>

				{servesModels ? (
					<Section className="gap-4 lg:col-span-3">
						<SectionHeader>
							<SectionTitle>
								{m.providers_detail_connected_models_title()}
							</SectionTitle>
							<SectionDescription>
								{m.providers_detail_connected_models_description()}
							</SectionDescription>
							<SectionAction>
								<DiscoverModels fixedProviderId={provider.id} />
							</SectionAction>
						</SectionHeader>
						<DataTable
							data={models.data}
							columns={providerModelColumns}
							state={{
								pagination: {
									pageIndex: search.pageIndex,
									pageSize: search.pageSize,
								},
								sorting: search.sort,
							}}
							options={{
								rowCount: models.rowCount,
								uidAccessor: "id",
							}}
						>
							<DataTableToolbar>
								<DataTableSearch
									placeholder={m.providers_detail_models_search_placeholder()}
								/>
								<DataTableToolbarActions>
									<ModelTableActions />
								</DataTableToolbarActions>
							</DataTableToolbar>
							<DataTableBody
								empty={{
									Icon: BoxIcon,
									title: m.providers_detail_no_models_title(),
									description: m.providers_detail_no_models_description(),
									actions: [
										{
											key: "add",
											label: m.providers_detail_add_model_button(),
											icon: PlusIcon,
											variant: "default",
											linkProps: {
												to: "/app/models/add",
											},
										},
									],
								}}
								filters={{
									query: search.query,
								}}
							/>
							<DataTablePagination />
						</DataTable>
					</Section>
				) : null}
			</PageContent>
		</Page>
	);
}
