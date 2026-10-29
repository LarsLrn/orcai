import type { CatalogueEntryDetail, CatalogueKind } from "@orcai/schema";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
	CheckIcon,
	ChevronDownIcon,
	CpuIcon,
	FileTextIcon,
	LibraryIcon,
	PackagePlusIcon,
} from "lucide-react";
import { useId, useState } from "react";
import {
	useActiveOrganizationName,
	useInstaller,
} from "@/components/catalogue/installer";
import { SourceOrganizationName } from "@/components/catalogue/resource-provenance";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldLabel,
} from "@/components/ui/field";
import { HeaderActions } from "@/components/ui/shell/actions";
import {
	DetailHeader,
	DetailHeaderBand,
	DetailHeaderDescription,
	DetailHeaderHeading,
	DetailHeaderIcon,
	DetailHeaderMeta,
	DetailHeaderTitle,
} from "@/components/ui/shell/detail-header";
import { Page, PageContent } from "@/components/ui/shell/page";
import { TileMark } from "@/components/ui/shell/tile";
import { ResourceOwner } from "@/components/users/resource-owner";
import { useInstallMutation } from "@/hooks/mutations/use-catalogue-mutations";
import type { CatalogueOrigin } from "@/lib/catalogue/catalogue-filters";
import { cataloguePaths, libraryLink } from "@/lib/navigation/catalogue-paths";
import { orpc } from "@/lib/orpc/orpc";
import { blockKind, RESOURCE_KINDS } from "@/lib/presentation/resource-kind";
import { catalogueEntryRef } from "@/lib/router/catalogue-entry-loader";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
	<h2 className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
		{children}
	</h2>
);

const Section = ({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) => (
	<section className="flex flex-col gap-2">
		<SectionLabel>{label}</SectionLabel>
		{children}
	</section>
);

const RowList = ({ children }: { children: React.ReactNode }) => (
	<ul className="flex flex-col divide-y rounded-2xl border">{children}</ul>
);

/** "Also add its behaviour and N repositories", for the blocks not added yet. */
const addBlocksLabel = (
	blocks: CatalogueEntryDetail["blocks"],
	organisation: string,
) => {
	const behaviour = blocks.some((block) => block.type === "template");
	const count = blocks.filter((block) => block.type === "database").length;
	if (count === 0)
		return m.catalogue_detail_add_blocks_behaviour({
			organisation,
		});
	return behaviour
		? m.catalogue_detail_add_blocks_both({
				organisation,
				count,
			})
		: m.catalogue_detail_add_blocks_repositories({
				organisation,
				count,
			});
};

/** Whether "Add" adds the bot's blocks not added yet too; unticked at first. */
const AddBlocksOption = ({
	blocks,
	organisation,
	checked,
	onCheckedChange,
}: {
	blocks: CatalogueEntryDetail["blocks"];
	organisation: string;
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
}) => {
	const id = useId();
	return (
		<Field orientation="horizontal">
			<Checkbox
				id={id}
				checked={checked}
				onCheckedChange={(value) => onCheckedChange(value === true)}
			/>
			<FieldContent>
				<FieldLabel htmlFor={id} className="font-normal">
					{addBlocksLabel(blocks, organisation)}
				</FieldLabel>
				<FieldDescription className="text-xs">
					{m.catalogue_detail_add_blocks_description()}
				</FieldDescription>
			</FieldContent>
		</Field>
	);
};

/** A bot's behaviour and repositories, each with what it holds. */
const BotContents = ({
	entry,
	organisation,
	children,
}: {
	entry: CatalogueEntryDetail;
	organisation: string | undefined;
	children?: React.ReactNode;
}) => (
	<Section label={m.catalogue_detail_inside_label()}>
		<RowList>
			{entry.blocks.length === 0 ? (
				<li className="p-3 text-muted-foreground text-sm">
					{m.catalogue_detail_model_only()}
				</li>
			) : (
				entry.blocks.map((block) => {
					const kind = blockKind(block.type);
					const { Icon, well, label } = RESOURCE_KINDS[kind];
					return (
						<li key={block.id} className="flex items-center gap-3 p-3">
							<span
								className={cn(
									"flex size-8 shrink-0 items-center justify-center rounded-lg [&>svg]:size-4",
									well,
								)}
							>
								<Icon aria-hidden="true" />
							</span>
							<div className="min-w-0 flex-1">
								<p className="truncate font-medium text-sm">{block.name}</p>
								<p className="text-muted-foreground text-xs">
									{block.documents === null
										? label()
										: m.catalogue_detail_repository_documents({
												count: block.documents,
											})}
								</p>
							</div>
							{block.state === "added" && organisation !== undefined ? (
								<span className="shrink-0 text-muted-foreground text-xs">
									{m.catalogue_added_label({
										organisation,
									})}
								</span>
							) : null}
						</li>
					);
				})
			)}
		</RowList>
		{children}
	</Section>
);

/** The model the author's setup asks for, and whether the active organisation has it. */
const BotModel = ({
	entry,
	organisation,
}: {
	entry: CatalogueEntryDetail;
	organisation: string | undefined;
}) => {
	const hint = entry.modelHint;
	return (
		<Section label={m.catalogue_detail_model_label()}>
			<div
				className={cn(
					"flex items-start gap-3 rounded-2xl p-3 text-sm",
					hint?.strength === "required"
						? "bg-status-warning/10"
						: "bg-muted/60",
				)}
			>
				<CpuIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
				<p>
					{hint === null
						? m.catalogue_detail_model_none()
						: hint.strength === "required"
							? m.catalogue_detail_model_required({
									model: hint.modelName,
								})
							: m.catalogue_detail_model_recommended({
									model: hint.modelName,
								})}
					{hint && organisation ? (
						<>
							{" "}
							{entry.authorsPick
								? m.catalogue_detail_model_usable({
										organisation,
									})
								: m.catalogue_detail_model_unusable({
										organisation,
									})}
						</>
					) : null}
				</p>
			</div>
		</Section>
	);
};

/** A behaviour's full prompt, open to read before adding it. */
const BehaviourPrompt = ({ prompt }: { prompt: string | null }) => (
	<details className="group flex flex-col rounded-2xl border p-4" open>
		<summary className="flex cursor-pointer list-none items-center justify-between rounded-sm font-semibold text-muted-foreground text-xs uppercase tracking-wider outline-none focus-visible:ring-[3px] focus-visible:ring-ring/75">
			{m.catalogue_detail_prompt_label()}
			<ChevronDownIcon
				className="size-4 transition-transform group-open:rotate-180"
				aria-hidden="true"
			/>
		</summary>
		<pre className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-muted/60 p-4 font-mono text-xs leading-relaxed">
			{prompt}
		</pre>
	</details>
);

/** A repository's first published documents, and how many more it holds. */
const RepositoryContents = ({ entry }: { entry: CatalogueEntryDetail }) => {
	const more = (entry.documents ?? 0) - entry.documentPreview.length;
	return (
		<Section label={m.catalogue_detail_contents_label()}>
			<RowList>
				{entry.documentPreview.length === 0 ? (
					<li className="p-3 text-muted-foreground text-sm">
						{m.blocks_tile_no_documents()}
					</li>
				) : null}
				{entry.documentPreview.map((document) => (
					<li key={document.id} className="flex items-center gap-3 p-3 text-sm">
						<FileTextIcon
							className="size-4 shrink-0 text-muted-foreground"
							aria-hidden="true"
						/>
						<span className="min-w-0 truncate">{document.title}</span>
					</li>
				))}
				{more > 0 ? (
					<li className="p-3 text-muted-foreground text-xs">
						{m.catalogue_detail_more_documents({
							count: more,
						})}
					</li>
				) : null}
			</RowList>
		</Section>
	);
};

/**
 * A catalogue entry's page: the store header with "Add to <org>", or
 * "Added" and "Open in Library", then what it holds to judge it by.
 */
export const CatalogueEntryPage = ({
	kind,
	id,
	from,
}: {
	kind: CatalogueKind;
	id: string;
	from: CatalogueOrigin | undefined;
}) => {
	const ref = catalogueEntryRef(kind, id);
	const navigate = useNavigate();
	const { data } = useSuspenseQuery(
		orpc.catalogue.find.queryOptions({
			input: {
				entry: ref,
			},
		}),
	);
	const entry = data.data;
	const installer = useInstaller();
	const organisation = useActiveOrganizationName();
	const { mutateAsync: install, isPending } = useInstallMutation({
		name: entry.name,
		organisation: organisation ?? "",
	});
	const { Icon, well, band, badge, label } = RESOURCE_KINDS[entry.kind];
	const added = entry.state === "added";
	const addableBlocks = entry.blocks.filter(
		(block) => block.state === "available",
	);
	const [withBlocks, setWithBlocks] = useState(false);
	const openInLibrary = {
		key: "open",
		label: m.catalogue_open_in_library_action(),
		icon: LibraryIcon,
		linkProps: libraryLink(entry),
	};

	return (
		<Page>
			<DetailHeader>
				<DetailHeaderBand className={band}>
					<Icon />
				</DetailHeaderBand>
				<DetailHeaderIcon className={well}>
					<Icon />
					{added ? <TileMark /> : null}
				</DetailHeaderIcon>
				<DetailHeaderHeading>
					<DetailHeaderTitle>{entry.name}</DetailHeaderTitle>
					<DetailHeaderMeta>
						<Badge variant={badge}>{label()}</Badge>
						<SourceOrganizationName organization={entry.source} />
						<ResourceOwner owner={entry.owner} />
					</DetailHeaderMeta>
					<HeaderActions
						leading={
							added && organisation !== undefined ? (
								<Badge variant="success">
									<CheckIcon aria-hidden="true" />
									{m.catalogue_added_label({
										organisation,
									})}
								</Badge>
							) : null
						}
						actions={
							entry.state === "available"
								? [
										installer && {
											key: "add",
											label: m.catalogue_add_action({
												organisation: installer.organisation,
											}),
											icon: PackagePlusIcon,
											variant: "default",
											loading: isPending,
											onClick: async () => {
												const result = await install({
													entry: ref,
													withBlocks: withBlocks && addableBlocks.length > 0,
												});
												if (result.status === "success")
													await navigate({
														to: cataloguePaths(entry.kind).add,
														params: {
															id: entry.id,
														},
														search: {
															from,
														},
													});
											},
										},
									]
								: [
										openInLibrary,
									]
						}
					/>
				</DetailHeaderHeading>
				{entry.description ? (
					<DetailHeaderDescription>{entry.description}</DetailHeaderDescription>
				) : null}
			</DetailHeader>

			<PageContent className="flex max-w-3xl flex-col gap-6">
				{entry.state === "available" && !installer && organisation ? (
					<p className="text-muted-foreground text-sm">
						{m.catalogue_detail_ask_installer({
							organisation,
						})}
					</p>
				) : null}
				{entry.kind === "bot" ? (
					<>
						<BotContents entry={entry} organisation={organisation}>
							{entry.state === "available" &&
							installer &&
							addableBlocks.length > 0 ? (
								<AddBlocksOption
									blocks={addableBlocks}
									organisation={installer.organisation}
									checked={withBlocks}
									onCheckedChange={setWithBlocks}
								/>
							) : null}
						</BotContents>
						<BotModel entry={entry} organisation={organisation} />
					</>
				) : entry.kind === "behaviour" ? (
					<BehaviourPrompt prompt={entry.prompt} />
				) : (
					<RepositoryContents entry={entry} />
				)}
			</PageContent>
		</Page>
	);
};
