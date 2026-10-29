import {
	type Asset,
	type AssetMetadataType,
	acceptedReviewFields,
	type MetadataReviewField,
	metadataReviewFields,
	type SourceType,
	sourceTypeLabels,
} from "@orcai/schema";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { LoaderCircleIcon, SparklesIcon } from "lucide-react";
import { useId, useState } from "react";
import type { AssetMetadataDraft } from "@/components/documents/shared/asset-metadata-editor";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	useDismissMetadataSuggestionMutation,
	useGenerateAssetMetadataMutation,
} from "@/hooks/mutations/use-asset-mutations";
import { useUtilityModel } from "@/hooks/use-utility-model";
import { orpc } from "@/lib/orpc/orpc";
import { getPipelineFailureDescription } from "@/lib/presentation/document-state";
import {
	isAssetWorking,
	isGeneratingMetadata,
	METADATA_POLL_MS,
} from "@/lib/presentation/metadata-status";
import { m } from "@/paraglide/messages";

const fieldLabels: Record<MetadataReviewField["field"], () => string> = {
	title: m.assets_metadata_source_title_label,
	sourceType: m.assets_metadata_source_type_label,
	author: m.assets_metadata_author_label,
	citation: m.assets_metadata_citation_label,
	chapterTitle: m.assets_metadata_chapter_title_label,
	pageRange: m.assets_metadata_page_range_label,
	journalName: m.assets_metadata_journal_name_label,
	volume: m.assets_metadata_volume_label,
	issueNumber: m.assets_metadata_issue_label,
	doi: m.assets_metadata_doi_label,
	websiteName: m.assets_metadata_website_name_label,
	accessDate: m.assets_metadata_access_date_label,
	externalUrl: m.assets_metadata_external_url_label,
	legalReference: m.assets_metadata_legal_reference_label,
	jurisdiction: m.assets_metadata_jurisdiction_label,
	description: m.assets_metadata_description_label,
	language: m.assets_metadata_language_label,
};

const shown = (field: MetadataReviewField["field"], value: string) =>
	field === "sourceType" && value
		? sourceTypeLabels[value as SourceType]
		: value || m.assets_metadata_review_empty_value();

/** The suggestion's fields with current and suggested value, each accepted or rejected. */
const MetadataReview = ({
	fields,
	onApply,
	onDismiss,
	dismissing,
}: {
	fields: MetadataReviewField[];
	onApply: (accepted: MetadataReviewField[]) => void;
	onDismiss: () => void;
	dismissing: boolean;
}) => {
	const id = useId();
	// Each choice holds for the value the field had when it was made; typing
	// into the field afterwards drops it.
	const [choices, setChoices] = useState(
		() =>
			new Map(
				fields
					.filter((field) => field.accept)
					.map(({ field, current }) => [
						field,
						current,
					]),
			),
	);
	const accepted = new Set(
		fields
			.filter(({ field, current }) => choices.get(field) === current)
			.map(({ field }) => field),
	);

	return (
		<section
			aria-labelledby={`${id}-title`}
			className="space-y-3 rounded-2xl border px-4 py-3"
		>
			<div className="space-y-1">
				<h3 id={`${id}-title`} className="font-medium text-sm">
					{m.assets_metadata_review_title()}
				</h3>
				<p className="text-muted-foreground text-sm">
					{fields.length > 0
						? m.assets_metadata_review_description()
						: m.assets_metadata_review_nothing_new()}
				</p>
			</div>
			<ul className="space-y-2">
				{fields.map((field) => (
					<li key={field.field} className="flex items-start gap-3 text-sm">
						<Checkbox
							id={`${id}-${field.field}`}
							checked={
								accepted.has(field.field) &&
								(!field.requiresType || accepted.has("sourceType"))
							}
							disabled={field.requiresType && !accepted.has("sourceType")}
							onCheckedChange={(checked) =>
								setChoices((current) => {
									const next = new Map(current);
									if (checked) next.set(field.field, field.current);
									else next.delete(field.field);
									return next;
								})
							}
							className="mt-0.5"
						/>
						<label
							htmlFor={`${id}-${field.field}`}
							className="min-w-0 space-y-0.5"
						>
							<span className="block font-medium">
								{fieldLabels[field.field]()}
							</span>
							<span className="block text-muted-foreground line-through">
								{shown(field.field, field.current)}
							</span>
							<span className="block break-words">
								{shown(field.field, field.suggested)}
							</span>
						</label>
					</li>
				))}
			</ul>
			<div className="flex flex-wrap justify-end gap-2">
				<Button
					variant="outline"
					size="sm"
					onClick={onDismiss}
					loading={dismissing}
				>
					{m.assets_metadata_review_dismiss_button()}
				</Button>
				{fields.length > 0 ? (
					<Button
						size="sm"
						onClick={() => onApply(acceptedReviewFields(fields, accepted))}
					>
						{m.assets_metadata_review_apply_button()}
					</Button>
				) : null}
			</div>
		</section>
	);
};

/**
 * Generate with AI for an asset in the metadata editor: generating, failing,
 * and reviewing the suggestion field by field. Accepted values go into the
 * form, which stays unsaved; the suggestion stays until the form is saved or
 * the suggestion dismissed.
 */
const MetadataGeneration = ({
	asset: initial,
	value,
	onApply,
}: {
	asset: Asset;
	value: AssetMetadataDraft;
	/** The form with the accepted values, and the generation they came from. */
	onApply: (next: AssetMetadataDraft, generation: number) => void;
}) => {
	const activeOrganization = useUtilityModel();
	const { data } = useQuery(
		orpc.asset.find.queryOptions({
			input: {
				id: initial.id,
			},
			refetchInterval: (query) =>
				isAssetWorking(query.state.data?.data ?? initial)
					? METADATA_POLL_MS
					: false,
		}),
	);
	const asset = data?.data ?? initial;
	// The asset's own organisation decides, which need not be the active one.
	const utilityModel = data
		? {
				loading: false,
				available: data.data.utilityModel === true,
				canChoose:
					activeOrganization.canChoose &&
					data.data.organizationId === activeOrganization.organizationId,
			}
		: {
				loading: true,
				available: false,
				canChoose: false,
			};
	const [applied, setApplied] = useState<number | null>(null);
	const { mutate: generate, isPending: generating } =
		useGenerateAssetMetadataMutation();
	const { mutate: dismiss, isPending: dismissing } =
		useDismissMetadataSuggestionMutation();

	const working = generating || isGeneratingMetadata(asset);
	const suggestion =
		!working && applied !== asset.metadataGeneration
			? asset.metadataSuggestion
			: null;
	const ready =
		asset.origin === "library" && asset.processingStatus === "completed";

	const apply = (accepted: MetadataReviewField[]) => {
		const metadata: AssetMetadataType = {
			...value.metadata,
		};
		let title = value.title;
		for (const field of accepted) {
			if (field.field === "title") {
				title = field.suggested;
			} else if (field.field === "sourceType") {
				metadata.sourceType = field.suggested as SourceType;
			} else {
				metadata[field.field] = field.suggested;
			}
		}
		setApplied(asset.metadataGeneration);
		onApply(
			{
				title,
				metadata,
			},
			asset.metadataGeneration,
		);
	};

	return (
		<div className="space-y-3 md:col-span-2">
			<div className="flex flex-wrap items-center gap-3">
				<Button
					type="button"
					variant="outline"
					size="sm"
					disabled={!utilityModel.available || !ready || working}
					onClick={() =>
						generate({
							id: asset.id,
						})
					}
				>
					{working ? (
						<LoaderCircleIcon className="animate-spin" />
					) : (
						<SparklesIcon />
					)}
					{working
						? m.assets_metadata_generating_label()
						: m.assets_metadata_generate_button()}
				</Button>
				{!utilityModel.loading && !utilityModel.available ? (
					<p className="text-muted-foreground text-sm">
						{m.assets_metadata_no_utility_model_hint()}{" "}
						{utilityModel.canChoose ? (
							<Link to="/app/organization" className="underline">
								{m.assets_metadata_organisation_settings_link()}
							</Link>
						) : null}
					</p>
				) : null}
				{utilityModel.available && !ready ? (
					<p className="text-muted-foreground text-sm">
						{m.assets_metadata_generate_unready_hint()}
					</p>
				) : null}
			</div>
			{working ? (
				<p role="status" className="text-muted-foreground text-sm">
					{m.assets_metadata_generating_description()}
				</p>
			) : null}
			{!working && asset.metadataStatus === "failed" ? (
				<p role="alert" className="text-sm text-status-danger">
					{m.assets_metadata_failed_description({
						reason: getPipelineFailureDescription(
							asset.metadataFailure ?? "other",
							asset.fileType,
						),
					})}
				</p>
			) : null}
			{suggestion ? (
				<MetadataReview
					key={asset.metadataGeneration}
					fields={metadataReviewFields(value, suggestion)}
					onApply={apply}
					onDismiss={() =>
						dismiss({
							id: asset.id,
							generation: asset.metadataGeneration,
						})
					}
					dismissing={dismissing}
				/>
			) : null}
		</div>
	);
};

export { MetadataGeneration };

/** On the asset page: metadata being generated, or a suggestion waiting for review. */
const MetadataStatusNotice = ({
	asset,
	canEdit,
}: {
	asset: Asset;
	canEdit: boolean;
}) => {
	if (isGeneratingMetadata(asset)) {
		return (
			<p
				role="status"
				className="flex items-center gap-2 text-muted-foreground text-sm"
			>
				<LoaderCircleIcon className="size-4 animate-spin" />
				{m.assets_metadata_generating_badge()}
			</p>
		);
	}
	if (!asset.metadataSuggestion || !canEdit) {
		return null;
	}
	return (
		<div
			role="status"
			className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-muted/60 px-4 py-3 text-sm"
		>
			<span className="flex items-center gap-2">
				<SparklesIcon className="size-4" />
				{m.assets_metadata_suggestions_ready()}
			</span>
			<Link
				to="/app/library/assets/$assetId/edit"
				params={{
					assetId: asset.id,
				}}
				className={buttonVariants({
					variant: "outline",
					size: "sm",
				})}
			>
				{m.assets_metadata_review_action()}
			</Link>
		</div>
	);
};

export { MetadataStatusNotice };
