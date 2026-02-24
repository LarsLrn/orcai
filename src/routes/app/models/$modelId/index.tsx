import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import {
	BadgeCheck,
	BadgeX,
	CalendarIcon,
	EditIcon,
	LinkIcon,
	ServerIcon,
	SparklesIcon,
	TagIcon,
} from "lucide-react";
import {
	Page,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/app/page";
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
import { modelCapabilities, providerCompatibilities } from "@/lib/ai/providers";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/models/$modelId/")({
	component: RouteComponent,
});

const capabilityLabelMap = new Map(
	modelCapabilities.map((capability) => [capability.value, capability.label]),
);

const compatibilityLabelMap = new Map(
	providerCompatibilities.map((compatibility) => [
		compatibility.value,
		compatibility.label,
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

function RouteComponent() {
	const { modelId } = Route.useParams();
	const { data: modelResponse } = useSuspenseQuery(
		orpc.model.find.queryOptions({
			input: { id: modelId },
		}),
	);

	const model = modelResponse.data;

	const { data: providerResponse } = useSuspenseQuery(
		orpc.provider.find.queryOptions({
			input: { id: model.providerId },
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
			</PageHeader>
			<PageContent>
				<Card className="relative overflow-hidden border-border/60 bg-linear-to-br from-card via-card to-muted/30">
					<div className="pointer-events-none absolute -top-20 -right-20 h-52 w-52 rounded-full bg-primary/10 blur-3xl" />
					<div className="pointer-events-none absolute -bottom-24 -left-8 h-48 w-48 rounded-full bg-primary/5 blur-3xl" />
					<CardContent className="relative space-y-8 py-8">
						<div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
							<div className="space-y-4">
								<div className="flex flex-wrap gap-2">
									<Badge
										variant={model.isDeprecated ? "destructive" : "secondary"}
									>
										{model.isDeprecated ? (
											<BadgeX className="h-3 w-3" />
										) : (
											<BadgeCheck className="h-3 w-3" />
										)}
										{model.isDeprecated ? "Deprecated" : "Active"}
									</Badge>
									<Badge variant="outline">
										<SparklesIcon className="h-3 w-3" />
										{capabilityLabels.length} capability
										{capabilityLabels.length === 1 ? "" : "ies"}
									</Badge>
									<Badge variant="outline">
										<ServerIcon className="h-3 w-3" />
										{compatibilityLabel}
									</Badge>
								</div>

								<div className="space-y-3">
									<h1 className="font-bold text-3xl tracking-tight md:text-4xl">
										{model.name}
									</h1>
									<p className="max-w-3xl text-muted-foreground leading-relaxed">
										{model.description}
									</p>
								</div>
							</div>

							<div className="flex flex-wrap gap-2">
								<Link
									to="/app/models/$modelId/edit"
									params={{ modelId }}
									className={buttonVariants({ variant: "default" })}
								>
									<EditIcon className="mr-2 h-4 w-4" />
									Edit Model
								</Link>
								<Link
									to="/app/providers/$providerId"
									params={{ providerId: provider.id }}
									className={buttonVariants({ variant: "outline" })}
								>
									<LinkIcon className="mr-2 h-4 w-4" />
									View Provider
								</Link>
							</div>
						</div>

						<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
							<div className="rounded-xl border border-border/60 bg-card/70 p-4">
								<p className="text-muted-foreground text-xs uppercase tracking-wide">
									Provider
								</p>
								<p className="mt-2 font-semibold text-sm">{provider.name}</p>
							</div>
							<div className="rounded-xl border border-border/60 bg-card/70 p-4">
								<p className="text-muted-foreground text-xs uppercase tracking-wide">
									Provider Model ID
								</p>
								<p className="mt-2 font-mono text-xs">
									{model.providerModelId}
								</p>
							</div>
							<div className="rounded-xl border border-border/60 bg-card/70 p-4">
								<p className="text-muted-foreground text-xs uppercase tracking-wide">
									Created
								</p>
								<p className="mt-2 font-semibold text-sm">
									{formatTimestamp(model.createdAt)}
								</p>
							</div>
							<div className="rounded-xl border border-border/60 bg-card/70 p-4">
								<p className="text-muted-foreground text-xs uppercase tracking-wide">
									Capabilities
								</p>
								<p className="mt-2 font-semibold text-sm">
									{capabilityLabels.length}
								</p>
							</div>
						</div>
					</CardContent>
				</Card>

				<div className="grid gap-6 lg:grid-cols-3">
					<Card className="lg:col-span-2">
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
									Model ID
								</div>
								<code className="rounded border bg-muted/40 px-2 py-1 font-mono text-xs">
									{model.id}
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
							<Separator />
							<div className="flex items-start justify-between gap-4">
								<div className="flex items-center gap-2 text-muted-foreground text-sm">
									<CalendarIcon className="h-4 w-4" />
									Registered
								</div>
								<span className="font-medium">
									{formatTimestamp(model.createdAt)}
								</span>
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
				</div>

				<Card>
					<CardHeader>
						<CardTitle>Provider Connection</CardTitle>
						<CardDescription>
							The provider endpoint and status backing this model.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="flex flex-wrap items-center justify-between gap-3">
							<div>
								<p className="font-semibold">{provider.name}</p>
								<p className="text-muted-foreground text-sm">
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
							params={{ providerId: provider.id }}
							className={buttonVariants({ variant: "outline" })}
						>
							<EditIcon className="mr-2 h-4 w-4" />
							Edit Provider
						</Link>
					</CardContent>
				</Card>
			</PageContent>
		</Page>
	);
}
