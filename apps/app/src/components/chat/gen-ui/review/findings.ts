import {
	type Severity,
	severitySchema,
} from "@/components/chat/gen-ui/review/schema";
import type { Status } from "@/components/chat/gen-ui/status";
import { isRecord, listOf, textOf } from "@/components/chat/gen-ui/streamed";
import { m } from "@/paraglide/messages";

export type StreamedFinding = {
	label?: string;
	/** Missing until it arrives whole. */
	severity?: Severity;
	note?: string;
	excerpt?: string;
};

export type StreamedItem = {
	label?: string;
	text?: string;
	revised?: string;
	/** Missing until the list arrives. */
	findings?: StreamedFinding[];
};

const findingOf = (value: unknown): StreamedFinding[] => {
	if (!isRecord(value)) {
		return [];
	}
	const severity = severitySchema.safeParse(value.severity);
	return [
		{
			label: textOf(value.label),
			severity: severity.success ? severity.data : undefined,
			note: textOf(value.note),
			excerpt: textOf(value.excerpt),
		},
	];
};

const findingsOf = (value: unknown) =>
	Array.isArray(value) ? value.flatMap(findingOf) : undefined;

const itemOf = (value: unknown): StreamedItem[] =>
	isRecord(value)
		? [
				{
					label: textOf(value.label),
					text: textOf(value.text),
					revised: textOf(value.revised),
					findings: findingsOf(value.findings),
				},
			]
		: [];

/** Partial or stored input, with malformed entries left out. */
export const reviewOf = (input: unknown) => {
	const review = isRecord(input) ? input : {};
	return {
		title: textOf(review.title),
		summary: textOf(review.summary),
		items: listOf(review.items).flatMap(itemOf),
		general: findingsOf(review.general) ?? [],
	};
};

export const severityStatus: Record<Severity, Status> = {
	error: "not_met",
	warning: "partial",
	info: "n_a",
};

export const severityLabel = (severity: Severity): string => {
	switch (severity) {
		case "error":
			return m.gen_ui_severity_error();
		case "warning":
			return m.gen_ui_severity_warning();
		case "info":
			return m.gen_ui_severity_info();
	}
};

/**
 * The worst finding decides. Undefined while the findings, or a severity that
 * could still be an error, have not arrived.
 */
export const itemStatus = (
	findings: readonly StreamedFinding[] | undefined,
): Status | undefined => {
	if (findings === undefined) {
		return undefined;
	}
	const severities = findings.map((finding) => finding.severity);
	if (severities.includes("error")) {
		return "not_met";
	}
	if (severities.includes(undefined)) {
		return undefined;
	}
	if (severities.includes("warning")) {
		return "partial";
	}
	return "met";
};

export type Anchor = {
	/** Index into the findings array. */
	finding: number;
	start: number;
	end: number;
	/** Footnote number, 1-based in text order. */
	number: number;
};

/**
 * Findings whose excerpt occurs in `text`, in text order. An excerpt that
 * overlaps an earlier one is left out.
 */
export const anchorFindings = (
	text: string,
	findings: readonly StreamedFinding[],
): Anchor[] => {
	const located = findings
		.flatMap((finding, index) => {
			const { excerpt } = finding;
			const start = excerpt ? text.indexOf(excerpt) : -1;
			return excerpt && start >= 0
				? [
						{
							finding: index,
							start,
							end: start + excerpt.length,
						},
					]
				: [];
		})
		.sort((a, b) => a.start - b.start || a.finding - b.finding);
	const anchors: Anchor[] = [];
	let cursor = 0;
	for (const entry of located) {
		if (entry.start >= cursor) {
			anchors.push({
				...entry,
				number: anchors.length + 1,
			});
			cursor = entry.end;
		}
	}
	return anchors;
};

/** Drops the asterisks of markdown emphasis. */
export const stripEmphasis = (text: string): string => text.replaceAll("*", "");
