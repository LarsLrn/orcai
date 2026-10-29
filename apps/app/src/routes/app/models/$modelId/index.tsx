import { hasNativeWebSearch } from "@orcai/core";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	BadgeCheck,
	BadgeX,
	CoinsIcon,
	EditIcon,
	LinkIcon,
	ScanTextIcon,
	ServerIcon,
	SparklesIcon,
	TagIcon,
	TextCursorInputIcon,
} from "lucide-react";
import { Fragment } from "react";
import { MetadataCard } from "@/components/app/metadata-card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { HeaderActions } from "@/components/ui/shell/actions";
import {
	Page,
	PageContent,
	PageDescription,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { orpc } from "@/lib/orpc/orpc";
import { formatNumber, formatPrice } from "@/lib/presentation/format-number";
import { getModelCapabilityLabel } from "@/lib/presentation/model-capability";
import {
	getModelStatusLabel,
	getModelStatusVariant,
} from "@/lib/presentation/model-status";
import { getProviderKindLabel } from "@/lib/presentation/provider-kind";
import {
	getProviderStatusLabel,
	getProviderStatusVariant,
} from "@/lib/presentation/provider-status";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/models/$modelId/")({
	component: RouteComponent,
});

function RouteComponent() {
	const { modelId } = Route.useParams();
	const { data: modelResponse } = useSuspenseQuery(
		orpc.model.find.queryOptions({
			input: {
				id: modelId,
			},
		}),
	);

	const model = modelResponse.data;

	const { data: providerResponse } = useSuspenseQuery(
		orpc.provider.find.queryOptions({
			input: {
				id: model.providerId,
			},
		}),
	);

	const provider = providerResponse.data;
	const kindLabel = getProviderKindLabel(provider.kind);
	const capabilityLabels = (model.capabilities ?? []).map(
		getModelCapabilityLabel,
	);
	const prices = [
		{
			label: m.models_form_input_price_label(),
			price: model.prices.input,
		},
		{
			label: m.models_form_output_price_label(),
			price: model.prices.output,
		},
		{
			label: m.models_form_cache_read_price_label(),
			price: model.prices.cacheRead,
		},
		{
			label: m.models_form_cache_write_price_label(),
			price: model.prices.cacheWrite,
		},
		{
			label: m.models_form_request_price_label(),
			price: model.prices.request,
		},
		...(hasNativeWebSearch(provider.kind)
			? [
					{
						label: m.models_form_web_search_price_label(),
						price: model.prices.webSearch,
					},
				]
			: []),
	];

	return (
		<Page>
			<PageHeader>
				<PageTitle>{model.name}</PageTitle>
				<PageDescription>{model.description}</PageDescription>
				<div className="flex flex-wrap gap-2">
					<Badge variant={getModelStatusVariant(model.isDeprecated)}>
						{model.isDeprecated ? (
							<BadgeX className="size-3" />
						) : (
							<BadgeCheck className="size-3" />
						)}
						{getModelStatusLabel(model.isDeprecated)}
					</Badge>
					<Badge variant="outline">
						<SparklesIcon className="size-3" />
						{m.models_detail_capability_count_badge({
							count: capabilityLabels.length,
						})}
					</Badge>
					<Badge variant="outline">
						<ServerIcon className="size-3" />
						{kindLabel}
					</Badge>
				</div>
				<HeaderActions
					actions={[
						{
							key: "edit",
							label: m.models_detail_edit_button(),
							icon: EditIcon,
							variant: "default",
							linkProps: {
								to: "/app/models/$modelId/edit",
								params: {
									modelId,
								},
							},
						},
						{
							key: "view-provider",
							label: m.models_detail_view_provider_button(),
							icon: LinkIcon,
							linkProps: {
								to: "/app/providers/$providerId",
								params: {
									providerId: provider.id,
								},
							},
						},
					]}
				/>
			</PageHeader>
			<PageContent className="grid grid-cols-1 gap-6 lg:grid-cols-3">
				<div className="space-y-6 lg:col-span-2">
					<Card>
						<CardHeader>
							<CardTitle>{m.models_detail_details_title()}</CardTitle>
							<CardDescription>
								{m.models_detail_details_description()}
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="flex items-start justify-between gap-4">
								<div className="flex items-center gap-2 text-muted-foreground text-sm">
									<TagIcon className="h-4 w-4" />
									{m.models_form_provider_model_id_label()}
								</div>
								<code className="rounded border bg-muted/40 px-2 py-1 font-mono text-xs">
									{model.providerModelId}
								</code>
							</div>
							<Separator />
							<div className="flex items-start justify-between gap-4">
								<div className="flex items-center gap-2 text-muted-foreground text-sm">
									<LinkIcon className="h-4 w-4" />
									{m.models_detail_provider_id_label()}
								</div>
								<code className="rounded border bg-muted/40 px-2 py-1 font-mono text-xs">
									{model.providerId}
								</code>
							</div>
							<Separator />
							<div className="flex items-start justify-between gap-4">
								<div className="flex items-center gap-2 text-muted-foreground text-sm">
									<ServerIcon className="h-4 w-4" />
									{m.models_detail_provider_kind_label()}
								</div>
								<span className="font-medium">{kindLabel}</span>
							</div>
							<Separator />
							<div className="flex items-start justify-between gap-4">
								<div className="flex items-center gap-2 text-muted-foreground text-sm">
									<ScanTextIcon className="h-4 w-4" />
									{m.models_form_context_window_label()}
								</div>
								<span className="font-medium tabular-nums">
									{formatNumber(
										model.contextWindow,
										m.models_detail_token_limit_unknown(),
									)}
								</span>
							</div>
							<Separator />
							<div className="flex items-start justify-between gap-4">
								<div className="flex items-center gap-2 text-muted-foreground text-sm">
									<TextCursorInputIcon className="h-4 w-4" />
									{m.models_form_max_output_tokens_label()}
								</div>
								<span className="font-medium tabular-nums">
									{formatNumber(
										model.maxOutputTokens,
										m.models_detail_token_limit_unknown(),
									)}
								</span>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>{m.models_form_prices_title()}</CardTitle>
							<CardDescription>
								{m.models_form_prices_description({
									currency: provider.currency,
								})}
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							{prices.map(({ label, price }, index) => (
								<Fragment key={label}>
									{index > 0 && <Separator />}
									<div className="flex items-start justify-between gap-4">
										<div className="flex items-center gap-2 text-muted-foreground text-sm">
											<CoinsIcon className="h-4 w-4" />
											{label}
										</div>
										<span className="font-medium tabular-nums">
											{price === null
												? m.models_detail_price_unset()
												: formatPrice(price, provider.currency)}
										</span>
									</div>
								</Fragment>
							))}
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>{m.common_capabilities_title()}</CardTitle>
							<CardDescription>
								{m.models_detail_capabilities_description()}
							</CardDescription>
						</CardHeader>
						<CardContent>
							{capabilityLabels.length === 0 ? (
								<p className="text-muted-foreground text-sm">
									{m.models_detail_no_capabilities_label()}
								</p>
							) : (
								<div className="flex flex-wrap gap-2">
									{capabilityLabels.map((capability) => (
										<Badge key={capability} variant="outline">
											{capability}
										</Badge>
									))}
								</div>
							)}
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>
								{m.models_detail_provider_connection_title()}
							</CardTitle>
							<CardDescription>
								{m.models_detail_provider_connection_description()}
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="flex flex-wrap items-center justify-between gap-3">
								<div className="min-w-0">
									<p className="font-semibold">{provider.name}</p>
									<p className="truncate text-muted-foreground text-sm">
										{provider.endpoint ?? m.providers_detail_endpoint_default()}
									</p>
								</div>
								<Badge variant={getProviderStatusVariant(provider.enabled)}>
									{provider.enabled ? (
										<BadgeCheck className="h-3 w-3" />
									) : (
										<BadgeX className="h-3 w-3" />
									)}
									{getProviderStatusLabel(provider.enabled)}
								</Badge>
							</div>
							<Separator />
							<Link
								to="/app/providers/$providerId/edit"
								params={{
									providerId: provider.id,
								}}
								className={buttonVariants({
									variant: "outline",
								})}
							>
								<EditIcon />
								{m.providers_detail_edit_button()}
							</Link>
						</CardContent>
					</Card>
				</div>

				<div className="space-y-6">
					<MetadataCard
						id={model.id}
						createdAt={model.createdAt}
						updatedAt={model.updatedAt}
					/>
				</div>
			</PageContent>
		</Page>
	);
}
