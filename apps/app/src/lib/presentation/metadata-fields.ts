import type { AppliedMetadataField } from "@orcai/schema";
import { m } from "@/paraglide/messages";

/** A metadata field's label, as the metadata editor shows it. */
export const metadataFieldLabels: Record<AppliedMetadataField, () => string> = {
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
