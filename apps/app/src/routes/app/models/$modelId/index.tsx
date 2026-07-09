import { modelCapabilities, providerCompatibilities } from "@orcai/core";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	BadgeCheck,
	BadgeX,
	EditIcon,
	LinkIcon,
	ServerIcon,
	SparklesIcon,
	TagIcon,
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

export const Route = createFileRoute("/app/models/$modelId/")({
	component: RouteComponent,
});

const capabilityLabelMap = new Map(
	modelCapabilities.map((capability) => [
		capability.value,
		capability.label,
	]),
);

const compatibilityLabelMap = new Map(
	providerCompatibilities.map((compatibility) => [
		compatibility.value,
		compatibility.label,
	]),
);

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
	const compatibilityLabel =
		compatibilityLabelMap.get(provider.compatibility) ?? provider.compatibility;
	const capabilityLabels = model.capabilities.map(
		(capability) => capabilityLabelMap.get(capability) ?? capability,
	);

	return (
		<Page>
			<PageHeader>
				<PageTitle>{model.name}</PageTitle>
				<PageDescription>{model.description}</PageDescription>
				<div className="flex flex-wrap gap-2">
					<Badge variant={model.isDeprecated ? "destructive" : "secondary"}>
						{model.isDeprecated ? (
							<BadgeX className="size-3" />
						) : (
							<BadgeCheck className="size-3" />
						)}
						{model.isDeprecated ? "Deprecated" : "Active"}
					</Badge>
					<Badge variant="outline">
						<SparklesIcon className="size-3" />
						{capabilityLabels.length} capability
						{capabilityLabels.length === 1 ? "" : "ies"}
					</Badge>
					<Badge variant="outline">
						<ServerIcon className="size-3" />
						{compatibilityLabel}
					</Badge>
				</div>
				<PageAction>
					<Link
						to="/app/models/$modelId/edit"
						params={{
							modelId,
						}}
						className={buttonVariants({
							variant: "default",
						})}
					>
						<EditIcon />
						Edit Model
					</Link>
					<Link
						to="/app/providers/$providerId"
						params={{
							providerId: provider.id,
						}}
						className={buttonVariants({
							variant: "outline",
						})}
					>
						<LinkIcon />
						View Provider
					</Link>
				</PageAction>
			</PageHeader>
			<PageContent className="grid gap-6 lg:grid-cols-3">
				<div className="space-y-6 lg:col-span-2">
					<Card>
						<CardHeader>
							<CardTitle>Model Details</CardTitle>
							<CardDescription>
								Core metadata used for routing and model selection.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="flex items-start justify-between gap-4">
								<div className="flex items-center gap-2 text-muted-foreground text-sm">
									<TagIcon className="h-4 w-4" />
									Provider Model ID
								</div>
								<code className="rounded border bg-muted/40 px-2 py-1 font-mono text-xs">
									{model.providerModelId}
								</code>
							</div>
							<Separator />
							<div className="flex items-start justify-between gap-4">
								<div className="flex items-center gap-2 text-muted-foreground text-sm">
									<LinkIcon className="h-4 w-4" />
									Provider ID
								</div>
								<code className="rounded border bg-muted/40 px-2 py-1 font-mono text-xs">
									{model.providerId}
								</code>
							</div>
							<Separator />
							<div className="flex items-start justify-between gap-4">
								<div className="flex items-center gap-2 text-muted-foreground text-sm">
									<ServerIcon className="h-4 w-4" />
									Provider Compatibility
								</div>
								<span className="font-medium">{compatibilityLabel}</span>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Capabilities</CardTitle>
							<CardDescription>
								Enabled capabilities for this model configuration.
							</CardDescription>
						</CardHeader>
						<CardContent>
							{capabilityLabels.length === 0 ? (
								<p className="text-muted-foreground text-sm">
									No capabilities configured.
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
							<CardTitle>Provider Connection</CardTitle>
							<CardDescription>
								The provider endpoint and status backing this model.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="flex flex-wrap items-center justify-between gap-3">
								<div className="min-w-0">
									<p className="font-semibold">{provider.name}</p>
									<p className="truncate text-muted-foreground text-sm">
										{provider.endpoint}
									</p>
								</div>
								<Badge variant={provider.enabled ? "secondary" : "destructive"}>
									{provider.enabled ? (
										<BadgeCheck className="h-3 w-3" />
									) : (
										<BadgeX className="h-3 w-3" />
									)}
									{provider.enabled ? "Enabled" : "Disabled"}
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
								Edit Provider
							</Link>
						</CardContent>
					</Card>
				</div>

				<div className="space-y-6">
					<MetadataCard id={model.id} createdAt={model.createdAt} />
				</div>
			</PageContent>
		</Page>
	);
}
