import {
	type Asset,
	MAX_DESCRIPTION_LENGTH,
	type SourceType,
	sourceTypeLabels,
	sourceTypes,
} from "@orcai/schema";
import { type ReactNode, useId } from "react";
import { OptionPicker } from "@/components/ui/composed/option-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { m } from "@/paraglide/messages";

type AssetMetadataDraft = {
	title: string;
	metadata: Asset["metadata"];
};

const createDefaultAssetMetadata = (): Asset["metadata"] => ({
	citation: "",
	externalUrl: "",
	pageRange: "",
	author: "",
	chapterTitle: "",
});

// ---------------------------------------------------------------------------
// Field helper
// ---------------------------------------------------------------------------

const MetadataField = ({
	label,
	value,
	placeholder,
	onChange,
	className,
}: {
	label: string;
	value: string;
	placeholder: string;
	onChange: (value: string) => void;
	className?: string;
}) => {
	const id = useId();

	return (
		<div className={className ?? "space-y-2"}>
			<Label htmlFor={id}>{label}</Label>
			<Input
				id={id}
				value={value}
				onChange={(event) => onChange(event.target.value)}
				placeholder={placeholder}
			/>
		</div>
	);
};

// ---------------------------------------------------------------------------
// Source-type–specific field sets
// ---------------------------------------------------------------------------

const BookFields = ({
	metadata,
	onFieldChange,
}: {
	metadata: Asset["metadata"];
	onFieldChange: (field: string, value: string) => void;
}) => (
	<>
		<MetadataField
			label={m.assets_metadata_author_label()}
			value={metadata.author ?? ""}
			placeholder={m.assets_metadata_author_placeholder()}
			onChange={(v) => onFieldChange("author", v)}
		/>
		<MetadataField
			label={m.assets_metadata_citation_label()}
			value={metadata.citation ?? ""}
			placeholder={m.assets_metadata_citation_placeholder()}
			onChange={(v) => onFieldChange("citation", v)}
		/>
		<MetadataField
			label={m.assets_metadata_chapter_title_label()}
			value={metadata.chapterTitle ?? ""}
			placeholder={m.assets_metadata_chapter_title_placeholder()}
			onChange={(v) => onFieldChange("chapterTitle", v)}
		/>
		<MetadataField
			label={m.assets_metadata_page_range_label()}
			value={metadata.pageRange ?? ""}
			placeholder="12-56"
			onChange={(v) => onFieldChange("pageRange", v)}
		/>
	</>
);

const JournalArticleFields = ({
	metadata,
	onFieldChange,
}: {
	metadata: Asset["metadata"];
	onFieldChange: (field: string, value: string) => void;
}) => (
	<>
		<MetadataField
			label={m.assets_metadata_author_label()}
			value={metadata.author ?? ""}
			placeholder={m.assets_metadata_author_placeholder()}
			onChange={(v) => onFieldChange("author", v)}
		/>
		<MetadataField
			label={m.assets_metadata_citation_label()}
			value={metadata.citation ?? ""}
			placeholder={m.assets_metadata_citation_placeholder()}
			onChange={(v) => onFieldChange("citation", v)}
		/>
		<MetadataField
			label={m.assets_metadata_journal_name_label()}
			value={metadata.journalName ?? ""}
			placeholder={m.assets_metadata_journal_name_placeholder()}
			onChange={(v) => onFieldChange("journalName", v)}
		/>
		<MetadataField
			label={m.assets_metadata_volume_label()}
			value={metadata.volume ?? ""}
			placeholder={m.assets_metadata_volume_placeholder()}
			onChange={(v) => onFieldChange("volume", v)}
		/>
		<MetadataField
			label={m.assets_metadata_issue_label()}
			value={metadata.issueNumber ?? ""}
			placeholder={m.assets_metadata_issue_placeholder()}
			onChange={(v) => onFieldChange("issueNumber", v)}
		/>
		<MetadataField
			label={m.assets_metadata_page_range_label()}
			value={metadata.pageRange ?? ""}
			placeholder="120-135"
			onChange={(v) => onFieldChange("pageRange", v)}
		/>
		<MetadataField
			label={m.assets_metadata_doi_label()}
			value={metadata.doi ?? ""}
			placeholder="10.1000/xyz123"
			onChange={(v) => onFieldChange("doi", v)}
		/>
	</>
);

const WebSourceFields = ({
	metadata,
	onFieldChange,
}: {
	metadata: Asset["metadata"];
	onFieldChange: (field: string, value: string) => void;
}) => (
	<>
		<MetadataField
			label={m.assets_metadata_author_label()}
			value={metadata.author ?? ""}
			placeholder={m.assets_metadata_author_placeholder()}
			onChange={(v) => onFieldChange("author", v)}
		/>
		<MetadataField
			label={m.assets_metadata_citation_label()}
			value={metadata.citation ?? ""}
			placeholder={m.assets_metadata_citation_placeholder()}
			onChange={(v) => onFieldChange("citation", v)}
		/>
		<MetadataField
			label={m.assets_metadata_website_name_label()}
			value={metadata.websiteName ?? ""}
			placeholder={m.assets_metadata_website_name_placeholder()}
			onChange={(v) => onFieldChange("websiteName", v)}
		/>
		<MetadataField
			label={m.assets_metadata_external_url_label()}
			value={metadata.externalUrl ?? ""}
			placeholder="https://example.com/article"
			className="space-y-2 md:col-span-2"
			onChange={(v) => onFieldChange("externalUrl", v)}
		/>
		<MetadataField
			label={m.assets_metadata_access_date_label()}
			value={metadata.accessDate ?? ""}
			placeholder="YYYY-MM-DD"
			onChange={(v) => onFieldChange("accessDate", v)}
		/>
	</>
);

const LegalTextFields = ({
	metadata,
	onFieldChange,
}: {
	metadata: Asset["metadata"];
	onFieldChange: (field: string, value: string) => void;
}) => (
	<>
		<MetadataField
			label={m.assets_metadata_citation_label()}
			value={metadata.citation ?? ""}
			placeholder={m.assets_metadata_citation_placeholder()}
			onChange={(v) => onFieldChange("citation", v)}
		/>
		<MetadataField
			label={m.assets_metadata_legal_reference_label()}
			value={metadata.legalReference ?? ""}
			placeholder={m.assets_metadata_legal_reference_placeholder()}
			onChange={(v) => onFieldChange("legalReference", v)}
		/>
		<MetadataField
			label={m.assets_metadata_jurisdiction_label()}
			value={metadata.jurisdiction ?? ""}
			placeholder={m.assets_metadata_jurisdiction_placeholder()}
			onChange={(v) => onFieldChange("jurisdiction", v)}
		/>
	</>
);

const sourceTypeFieldComponents: Record<SourceType, typeof BookFields> = {
	book: BookFields,
	"journal-article": JournalArticleFields,
	"web-source": WebSourceFields,
	"legal-text": LegalTextFields,
};

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

const AssetMetadataEditor = ({
	value,
	onChange,
	showTitle = true,
	generation,
}: {
	value: AssetMetadataDraft;
	onChange: (nextValue: AssetMetadataDraft) => void;
	showTitle?: boolean;
	/** Generate with AI, above the fields. */
	generation?: ReactNode;
}) => {
	const metadata = value.metadata ?? createDefaultAssetMetadata();
	const id = useId();

	const onFieldChange = (field: string, fieldValue: string) =>
		onChange({
			...value,
			metadata: {
				...metadata,
				[field]: fieldValue,
			},
		});

	const SourceFields =
		metadata.sourceType && sourceTypeFieldComponents[metadata.sourceType];

	return (
		<div className="grid gap-4 md:grid-cols-2">
			{generation}
			{showTitle ? (
				<div className="space-y-2 md:col-span-2">
					<Label htmlFor={`${id}-title`}>
						{m.assets_metadata_source_title_label()}
					</Label>
					<Input
						id={`${id}-title`}
						value={value.title}
						onChange={(event) =>
							onChange({
								...value,
								title: event.target.value,
							})
						}
						placeholder={m.assets_metadata_source_title_placeholder()}
					/>
				</div>
			) : null}

			<div className="space-y-2 md:col-span-2">
				<Label htmlFor={`${id}-source-type`}>
					{m.assets_metadata_source_type_label()}
				</Label>
				<OptionPicker<SourceType>
					id={`${id}-source-type`}
					options={sourceTypes.map((type) => ({
						value: type,
						label: sourceTypeLabels[type],
					}))}
					value={metadata.sourceType ?? null}
					onChange={(sourceType) =>
						onChange({
							...value,
							metadata: {
								...metadata,
								sourceType,
							},
						})
					}
					placeholder={m.assets_metadata_source_type_placeholder()}
					className="w-full"
				/>
			</div>

			{SourceFields ? (
				<SourceFields metadata={metadata} onFieldChange={onFieldChange} />
			) : null}

			<div className="space-y-2 md:col-span-2">
				<Label htmlFor={`${id}-description`}>
					{m.assets_metadata_description_label()}
				</Label>
				<Textarea
					id={`${id}-description`}
					value={metadata.description ?? ""}
					maxLength={MAX_DESCRIPTION_LENGTH}
					onChange={(event) => onFieldChange("description", event.target.value)}
					placeholder={m.assets_metadata_description_placeholder()}
				/>
			</div>

			<MetadataField
				label={m.assets_metadata_language_label()}
				value={metadata.language ?? ""}
				placeholder={m.assets_metadata_language_placeholder()}
				onChange={(v) => onFieldChange("language", v)}
			/>

			{/* External URL is always available when the source type doesn't already include it */}
			{metadata.sourceType && metadata.sourceType !== "web-source" ? (
				<MetadataField
					label={m.assets_metadata_external_url_label()}
					value={metadata.externalUrl ?? ""}
					placeholder="https://example.org/article"
					className="space-y-2 md:col-span-2"
					onChange={(v) => onFieldChange("externalUrl", v)}
				/>
			) : null}
		</div>
	);
};

export {
	type AssetMetadataDraft,
	AssetMetadataEditor,
	createDefaultAssetMetadata,
};
