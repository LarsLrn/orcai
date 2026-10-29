import type { CatalogueKind, OrganizationProfile } from "@orcai/schema";
import { Link } from "@tanstack/react-router";
import { ArrowRightIcon, PencilIcon } from "lucide-react";
import {
	ContentRenderer,
	isContentEmpty,
} from "@/components/editor/content-renderer";
import { descriptionExtensions } from "@/components/editor/extensions";
import { OrganizationLogo } from "@/components/organizations/organization-logo";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { useSetActiveOrganizationMutation } from "@/hooks/mutations/use-user-mutations";
import { cataloguePaths } from "@/lib/navigation/catalogue-paths";
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
		m.organization_profile_bots({
			count,
		}),
	behaviour: (count) =>
		m.organization_profile_behaviours({
			count,
		}),
	repository: (count) =>
		m.organization_profile_repositories({
			count,
		}),
};

/** How many entries of a kind the organisation lists, linking to them in the catalogue. */
const ListedCount = ({
	organization,
	kind,
}: {
	organization: OrganizationProfile;
	kind: CatalogueKind;
}) => {
	const { Icon, well } = RESOURCE_KINDS[kind];
	const count = organization.listed[kind];
	const body = (
		<>
			<span
				className={cn(
					"flex size-10 shrink-0 items-center justify-center rounded-xl [&>svg]:size-5",
					well,
				)}
			>
				<Icon aria-hidden="true" />
			</span>
			<span className="flex-1">
				<span className="block font-heading font-semibold text-2xl tabular-nums leading-tight">
					{count}
				</span>
				<span className="block text-muted-foreground text-sm">
					{kindCount[kind](count)}
				</span>
			</span>
		</>
	);
	const card =
		"flex items-center gap-3 rounded-3xl border bg-card px-4 py-3 outline-none";

	if (count === 0)
		return (
			<li className={cn(card, "text-muted-foreground opacity-60")}>{body}</li>
		);

	return (
		<li className="contents">
			<Link
				to={cataloguePaths(kind).list}
				search={{
					organizationIds: [
						organization.id,
					],
				}}
				className={cn(
					card,
					"group/count shadow-xs transition hover:border-foreground/15 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/75",
				)}
			>
				{body}
				<ArrowRightIcon
					aria-hidden="true"
					className="size-4 text-muted-foreground transition-transform motion-safe:group-hover/count:translate-x-1"
				/>
			</Link>
		</li>
	);
};

/** Opens the settings, which edit the active organisation: switches to this one first. */
const EditAction = ({
	organization,
	isActive,
}: {
	organization: OrganizationProfile;
	isActive: boolean;
}) => {
	const switchTo = useSetActiveOrganizationMutation(
		{},
		{
			to: "/app/organization",
		},
	);
	const look = buttonVariants({
		variant: "ghost",
		size: "sm",
	});
	const content = (
		<>
			<PencilIcon aria-hidden="true" />
			{m.organization_profile_edit_link()}
		</>
	);

	return isActive ? (
		<Link to="/app/organization" className={look}>
			{content}
		</Link>
	) : (
		<Button
			variant="ghost"
			size="sm"
			loading={switchTo.isPending}
			onClick={() =>
				switchTo.mutate({
					organizationId: organization.id,
				})
			}
		>
			{content}
		</Button>
	);
};

/**
 * An organisation's page: its logo, name, description and how much it lists
 * in the catalogue. `canEdit` adds Edit, which opens its settings.
 */
const OrganizationProfilePage = ({
	organization,
	isActive,
	canEdit,
}: {
	organization: OrganizationProfile;
	isActive: boolean;
	canEdit: boolean;
}) => (
	<div className="mx-auto flex max-w-3xl flex-col gap-10 pt-4">
		<header className="flex flex-col items-center gap-4 text-center">
			<OrganizationLogo
				organization={organization}
				className="size-24 rounded-3xl shadow-md after:rounded-3xl [&_[data-slot=avatar-fallback]]:rounded-3xl [&_[data-slot=avatar-fallback]]:text-2xl [&_img]:rounded-3xl"
			/>
			<h1 className="text-balance font-heading font-semibold text-4xl tracking-tight">
				{organization.name}
			</h1>
			{isActive || canEdit ? (
				<div className="flex items-center gap-2">
					{isActive ? (
						<Badge variant="secondary">
							{m.organization_profile_active_badge()}
						</Badge>
					) : null}
					{canEdit ? (
						<EditAction organization={organization} isActive={isActive} />
					) : null}
				</div>
			) : null}
		</header>

		<section
			aria-label={m.organization_profile_description_label()}
			className="rounded-3xl border bg-card p-6 shadow-xs md:p-10"
		>
			{isContentEmpty(organization.description, descriptionExtensions) ? (
				<p className="text-muted-foreground text-sm">
					{canEdit
						? m.organization_profile_no_description_admin()
						: m.organization_profile_no_description()}
				</p>
			) : (
				<ContentRenderer
					content={organization.description}
					extensions={descriptionExtensions}
					className="prose-li:my-1 prose-headings:font-heading prose-headings:font-semibold prose-a:text-primary prose-h2:text-lg prose-h3:text-base dark:prose-a:text-accent-brand [&_li>p]:my-0"
				/>
			)}
		</section>

		<nav aria-label={m.organization_profile_listed_label()}>
			<ul className="grid gap-3 sm:grid-cols-3">
				{KINDS.map((kind) => (
					<ListedCount key={kind} organization={organization} kind={kind} />
				))}
			</ul>
		</nav>
	</div>
);

export { OrganizationProfilePage };
