import type { CatalogueKind } from "@orcai/schema";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useRouteContext } from "@tanstack/react-router";
import { ChevronRightIcon, PencilIcon } from "lucide-react";
import { OrganizationLogo } from "@/components/organizations/organization-logo";
import { buttonVariants } from "@/components/ui/button";
import { cataloguePaths } from "@/lib/navigation/catalogue-paths";
import { orpc } from "@/lib/orpc/orpc";
import { RESOURCE_KINDS } from "@/lib/presentation/resource-kind";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

const KINDS: readonly CatalogueKind[] = [
	"bot",
	"behaviour",
	"repository",
];

const kindCount: Record<CatalogueKind, (count: number) => string> = {
	bot: (count) =>
		m.home_organization_bots({
			count,
		}),
	behaviour: (count) =>
		m.home_organization_behaviours({
			count,
		}),
	repository: (count) =>
		m.home_organization_repositories({
			count,
		}),
};

/** The active organisation: what it lists in the catalogue, and a way to its page. */
const OrganizationCard = () => {
	const { auth, isOrganizationAdmin } = useRouteContext({
		from: "/app/_home",
	});
	const { data: profile } = useSuspenseQuery(
		orpc.organization.profile.queryOptions({
			input: {
				id: auth.session.activeOrganizationId,
			},
		}),
	);
	const organization = profile.data;

	return (
		<aside
			aria-label={m.organization_profile_active_badge()}
			className="overflow-hidden rounded-3xl border bg-card shadow-xs"
		>
			<div className="flex items-center gap-4 border-b bg-muted/40 p-5">
				<OrganizationLogo
					organization={organization}
					className="size-16 rounded-xl after:rounded-xl [&_[data-slot=avatar-fallback]]:rounded-xl [&_[data-slot=avatar-fallback]]:text-lg [&_img]:rounded-xl"
				/>
				<div className="min-w-0">
					<h2 className="line-clamp-2 break-words font-heading font-semibold text-xl leading-tight tracking-tight">
						{organization.name}
					</h2>
					<p className="text-muted-foreground text-xs">
						{m.organization_profile_active_badge()}
					</p>
				</div>
			</div>
			<div className="space-y-4 p-5">
				<ul className="-mx-2">
					{KINDS.map((kind) => {
						const { Icon, well } = RESOURCE_KINDS[kind];
						const count = organization.listed[kind];
						const body = (
							<>
								<span
									className={cn(
										"flex size-7 shrink-0 items-center justify-center rounded-md [&>svg]:size-3.5",
										well,
									)}
								>
									<Icon aria-hidden="true" />
								</span>
								{kindCount[kind](count)}
							</>
						);
						const row =
							"flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm";

						return (
							<li key={kind}>
								{count === 0 ? (
									<span className={cn(row, "text-muted-foreground")}>
										{body}
									</span>
								) : (
									<Link
										to={cataloguePaths(kind).list}
										search={{
											organizationIds: [
												organization.id,
											],
										}}
										className={cn(
											row,
											"outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/75",
										)}
									>
										{body}
										<ChevronRightIcon
											aria-hidden="true"
											className="ml-auto size-4 text-muted-foreground"
										/>
									</Link>
								)}
							</li>
						);
					})}
				</ul>
				<div className="flex flex-wrap gap-2">
					<Link
						to="/app/organizations/$organizationId"
						params={{
							organizationId: organization.id,
						}}
						className={buttonVariants({
							variant: "outline",
							size: "sm",
						})}
					>
						{m.home_organization_page_action()}
					</Link>
					{isOrganizationAdmin ? (
						<Link
							to="/app/organization"
							className={buttonVariants({
								variant: "ghost",
								size: "sm",
							})}
						>
							<PencilIcon aria-hidden="true" />
							{m.organization_profile_edit_link()}
						</Link>
					) : null}
				</div>
			</div>
		</aside>
	);
};

export { OrganizationCard };
