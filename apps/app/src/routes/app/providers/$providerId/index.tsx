import { modelCapabilities, providerCompatibilities } from "@orcai/core";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
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
		return "Not available";
	}

	const parsedDate =
		timestamp instanceof Date ? timestamp : new Date(timestamp);
	return Number.isNaN(parsedDate.getTime())
		? "Not available"
		: format(parsedDate, "MMM dd, yyyy 'at' HH:mm");
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
						{provider.enabled ? "Enabled" : "Disabled"}
					</Badge>
					<Badge variant="outline">
						<ServerIcon className="size-3" />
						{compatibilityLabel}
					</Badge>
					<Badge variant="outline">
						<BotIcon className="size-3" />
						{providerModels.length} model
						{providerModels.length === 1 ? "" : "s"}
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
						Edit Provider
					</Link>
					<Link
						to="/app/models/add"
						className={buttonVariants({
							variant: "outline",
						})}
					>
						<PlusIcon />
						Add Model
					</Link>
				</PageAction>
			</PageHeader>
			<PageContent className="grid gap-6 lg:grid-cols-3">
				<div className="space-y-6 lg:col-span-2">
					<Card>
						<CardHeader>
							<CardTitle>Provider Overview</CardTitle>
							<CardDescription>
								Model coverage and endpoint summary for this provider.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
								<div>
									<div className="text-muted-foreground text-xs uppercase">
										Endpoint Host
									</div>
									<div className="mt-1 font-semibold text-sm">
										{endpointHost}
									</div>
								</div>
								<div>
									<div className="text-muted-foreground text-xs uppercase">
										Active Models
									</div>
									<div className="mt-1 font-semibold text-sm">
										{activeModelCount}
									</div>
								</div>
								<div>
									<div className="text-muted-foreground text-xs uppercase">
										Deprecated Models
									</div>
									<div className="mt-1 font-semibold text-sm">
										{deprecatedModelCount}
									</div>
								</div>
								<div>
									<div className="text-muted-foreground text-xs uppercase">
										Capability Coverage
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
							<CardTitle>Provider Configuration</CardTitle>
							<CardDescription>
								Connection details and metadata for this provider profile.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="flex items-start justify-between gap-4">
								<div className="flex items-center gap-2 text-muted-foreground text-sm">
									<ServerIcon className="h-4 w-4" />
									Compatibility
								</div>
								<span className="font-medium">{compatibilityLabel}</span>
							</div>
							<Separator />
							<div className="flex items-start justify-between gap-4">
								<div className="flex items-center gap-2 text-muted-foreground text-sm">
									<ServerIcon className="h-4 w-4" />
									Endpoint
								</div>
								<code className="rounded border bg-muted/40 px-2 py-1 font-mono text-xs">
									{provider.endpoint}
								</code>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Capabilities</CardTitle>
							<CardDescription>
								Aggregated from models connected to this provider.
							</CardDescription>
						</CardHeader>
						<CardContent>
							{supportedCapabilities.length === 0 ? (
								<p className="text-muted-foreground text-sm">
									No capabilities available yet.
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
							<CardTitle>Connected Models</CardTitle>
							<CardDescription>
								Models currently configured to use this provider.
							</CardDescription>
						</CardHeader>
						<CardContent>
							{providerModels.length === 0 ? (
								<div className="rounded-xl border border-border border-dashed p-6 text-center">
									<p className="font-medium">No models connected yet</p>
									<p className="mt-1 text-muted-foreground text-sm">
										Add a model to start using this provider in bots.
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
													variant={
														model.isDeprecated ? "destructive" : "secondary"
													}
												>
													{model.isDeprecated ? (
														<BadgeX className="h-3 w-3" />
													) : (
														<BadgeCheck className="h-3 w-3" />
													)}
													{model.isDeprecated ? "Deprecated" : "Active"}
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
												<span>Created {formatTimestamp(model.createdAt)}</span>
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
													View
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
