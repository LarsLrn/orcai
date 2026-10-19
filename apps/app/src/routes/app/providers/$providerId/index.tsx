import { modelCapabilities, providerCompatibilities } from "@orcai/core";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	BadgeCheck,
	BadgeX,
	BotIcon,
	EditIcon,
	PlusIcon,
	ServerIcon,
	SparklesIcon,
} from "lucide-react";
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
import {
	Page,
	PageAction,
	PageContent,
	PageDescription,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { orpc } from "@/lib/orpc/orpc";
import { formatDisplayTimestamp } from "@/lib/presentation/format-timestamp";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/providers/$providerId/")({
	component: RouteComponent,
});

const compatibilityLabelMap = new Map(
	providerCompatibilities.map((compatibility) => [
		compatibility.value,
		compatibility.label,
	]),
);

const capabilityLabelMap = new Map(
	modelCapabilities.map((capability) => [
		capability.value,
		capability.label,
	]),
);

const formatTimestamp = (timestamp?: Date | string | null) => {
	if (!timestamp) {
		return m.providers_detail_timestamp_not_available();
	}

	const parsedDate =
		timestamp instanceof Date ? timestamp : new Date(timestamp);
	return Number.isNaN(parsedDate.getTime())
		? m.providers_detail_timestamp_not_available()
		: formatDisplayTimestamp(parsedDate);
};

const getEndpointHost = (endpoint: string) => {
	try {
		return new URL(endpoint).host;
	} catch {
		return endpoint;
	}
};

function RouteComponent() {
	const { providerId } = Route.useParams();
	const { data: providerResponse } = useSuspenseQuery(
		orpc.provider.find.queryOptions({
			input: {
				id: providerId,
			},
		}),
	);

	const { data: modelsResponse } = useSuspenseQuery(
		orpc.model.list.queryOptions({
			input: {
				pageIndex: 0,
				pageSize: 500,
			},
		}),
	);

	const provider = providerResponse.data;
	const providerModels = modelsResponse.data.filter(
		(model) => model.providerId === provider.id,
	);
	const deprecatedModelCount = providerModels.filter(
		(model) => model.isDeprecated,
	).length;
	const activeModelCount = providerModels.length - deprecatedModelCount;
	const supportedCapabilities = Array.from(
		new Set(providerModels.flatMap((model) => model.capabilities)),
	).map((capability) => capabilityLabelMap.get(capability) ?? capability);
	const compatibilityLabel =
		compatibilityLabelMap.get(provider.compatibility) ?? provider.compatibility;
	const endpointHost = getEndpointHost(provider.endpoint);

	return (
		<Page>
			<PageHeader>
				<PageTitle>{provider.name}</PageTitle>
				<PageDescription>{provider.description}</PageDescription>
				<div className="flex flex-wrap gap-2">
					<Badge variant={provider.enabled ? "secondary" : "destructive"}>
						{provider.enabled ? (
							<BadgeCheck className="size-3" />
						) : (
							<BadgeX className="size-3" />
						)}
						{provider.enabled
							? m.common_status_enabled_label()
							: m.common_status_disabled_label()}
					</Badge>
					<Badge variant="outline">
						<ServerIcon className="size-3" />
						{compatibilityLabel}
					</Badge>
					<Badge variant="outline">
						<BotIcon className="size-3" />
						{m.providers_detail_model_count_badge({
							count: providerModels.length,
						})}
					</Badge>
				</div>
				<PageAction>
					<Link
						to="/app/providers/$providerId/edit"
						params={{
							providerId,
						}}
						className={buttonVariants({
							variant: "default",
						})}
					>
						<EditIcon />
						{m.providers_detail_edit_button()}
					</Link>
					<Link
						to="/app/models/add"
						className={buttonVariants({
							variant: "outline",
						})}
					>
						<PlusIcon />
						{m.providers_detail_add_model_button()}
					</Link>
				</PageAction>
			</PageHeader>
			<PageContent className="grid grid-cols-1 gap-6 lg:grid-cols-3">
				<div className="space-y-6 lg:col-span-2">
					<Card>
						<CardHeader>
							<CardTitle>{m.providers_detail_overview_title()}</CardTitle>
							<CardDescription>
								{m.providers_detail_overview_description()}
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
								<div>
									<div className="text-muted-foreground text-xs uppercase">
										{m.providers_detail_endpoint_host_label()}
									</div>
									<div className="mt-1 font-semibold text-sm">
										{endpointHost}
									</div>
								</div>
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
										{deprecatedModelCount}
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
									{m.providers_form_compatibility_label()}
								</div>
								<span className="font-medium">{compatibilityLabel}</span>
							</div>
							<Separator />
							<div className="flex items-start justify-between gap-4">
								<div className="flex items-center gap-2 text-muted-foreground text-sm">
									<ServerIcon className="h-4 w-4" />
									{m.providers_form_endpoint_label()}
								</div>
								<code className="rounded border bg-muted/40 px-2 py-1 font-mono text-xs">
									{provider.endpoint}
								</code>
							</div>
						</CardContent>
					</Card>

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

					<Card>
						<CardHeader>
							<CardTitle>
								{m.providers_detail_connected_models_title()}
							</CardTitle>
							<CardDescription>
								{m.providers_detail_connected_models_description()}
							</CardDescription>
						</CardHeader>
						<CardContent>
							{providerModels.length === 0 ? (
								<div className="rounded-xl border border-border border-dashed p-6 text-center">
									<p className="font-medium">
										{m.providers_detail_no_models_title()}
									</p>
									<p className="mt-1 text-muted-foreground text-sm">
										{m.providers_detail_no_models_description()}
									</p>
								</div>
							) : (
								<div className="grid gap-4 md:grid-cols-2">
									{providerModels.map((model) => (
										<div
											key={model.id}
											className="space-y-3 rounded-xl border border-border/60 bg-card/60 p-4"
										>
											<div className="flex flex-wrap items-start justify-between gap-2">
												<div>
													<p className="font-semibold">{model.name}</p>
													<p className="font-mono text-muted-foreground text-xs">
														{model.providerModelId}
													</p>
												</div>
												<Badge
													variant={model.isDeprecated ? "warning" : "success"}
												>
													{model.isDeprecated ? (
														<BadgeX className="h-3 w-3" />
													) : (
														<BadgeCheck className="h-3 w-3" />
													)}
													{model.isDeprecated
														? m.common_status_deprecated_label()
														: m.common_status_active_label()}
												</Badge>
											</div>

											<div className="flex flex-wrap gap-2">
												{model.capabilities.map((capability) => (
													<Badge key={capability} variant="outline">
														{capabilityLabelMap.get(capability) ?? capability}
													</Badge>
												))}
											</div>

											<div className="flex items-center justify-between text-muted-foreground text-xs">
												<span>
													{m.providers_detail_model_created_label({
														timestamp: formatTimestamp(model.createdAt),
													})}
												</span>
												<Link
													to="/app/models/$modelId"
													params={{
														modelId: model.id,
													}}
													className={buttonVariants({
														variant: "outline",
														size: "sm",
													})}
												>
													{m.providers_detail_view_model_link()}
												</Link>
											</div>
										</div>
									))}
								</div>
							)}
						</CardContent>
					</Card>
				</div>

				<div className="space-y-6">
					<MetadataCard
						id={provider.id}
						createdAt={provider.createdAt}
						updatedAt={provider.updatedAt}
					/>
				</div>
			</PageContent>
		</Page>
	);
}
