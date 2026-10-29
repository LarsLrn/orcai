import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type {
	ActivityRunId,
	AssetId,
	BlockId,
	DataExportId,
	OrganizationId,
} from "@orcai/core";
import type {
	ActivityFailure,
	ActivityMember,
	ActivityRun,
} from "@orcai/schema";
import { getLocale, overwriteGetLocale } from "@/paraglide/runtime";
import {
	activityLabel,
	failureSummary,
	failureTitle,
	fieldSummary,
	memberStage,
	runSummary,
	runTitle,
	runToast,
} from "./activity";

const originalGetLocale = getLocale;

beforeEach(() => {
	overwriteGetLocale(() => "en");
});

afterEach(() => {
	overwriteGetLocale(originalGetLocale);
});

const organization = {
	id: "org-1" as OrganizationId,
	name: "Methods Lab",
};
const repository = {
	id: "block-1" as BlockId,
	name: "Reading list",
};
const asset = {
	id: "asset-1" as AssetId,
	title: "field-notes-03.pdf",
};

const run = (overrides: Partial<ActivityRun> = {}): ActivityRun => ({
	id: "run-1" as ActivityRunId,
	kind: "upload",
	state: "running",
	createdAt: new Date(),
	organization,
	repository: null,
	asset: null,
	progress: {
		total: 40,
		done: 12,
		failed: 0,
	},
	metadata: null,
	dataExport: null,
	...overrides,
});

describe("runTitle", () => {
	test("names the action and where it went", () => {
		expect(runTitle(run())).toBe("Upload to Library");
		expect(
			runTitle(
				run({
					repository,
				}),
			),
		).toBe("Upload to Reading list");
		expect(
			runTitle(
				run({
					kind: "fill_metadata",
				}),
			),
		).toBe("Generate missing metadata");
		expect(
			runTitle(
				run({
					kind: "export",
				}),
			),
		).toBe("Export of your data");
	});

	test("names a retry by its asset, else its repository", () => {
		expect(
			runTitle(
				run({
					kind: "retry",
					asset,
					repository,
				}),
			),
		).toBe("Prepare again: field-notes-03.pdf");
		expect(
			runTitle(
				run({
					kind: "retry",
					repository,
				}),
			),
		).toBe("Prepare again in Reading list");
		expect(
			runTitle(
				run({
					kind: "retry",
				}),
			),
		).toBe("Prepare again");
	});

	test("a suggestion whose asset the user can no longer read keeps a title", () => {
		expect(
			runTitle(
				run({
					kind: "suggest_metadata",
				}),
			),
		).toBe("Metadata suggestion");
	});
});

describe("runSummary", () => {
	test("a running upload counts its files, or says it is still uploading", () => {
		expect(runSummary(run())).toBe("12 of 40 files ready · Methods Lab");
		expect(
			runSummary(
				run({
					progress: {
						total: 0,
						done: 0,
						failed: 0,
					},
				}),
			),
		).toBe("Uploading files · Methods Lab");
		expect(
			runSummary(
				run({
					kind: "fill_metadata",
					organization: null,
				}),
			),
		).toBe("12 of 40 assets done");
	});

	test("a finished entry gives its state and outcome", () => {
		expect(
			runSummary(
				run({
					kind: "fill_metadata",
					state: "finished",
					metadata: {
						updated: 38,
						unchanged: 2,
					},
				}),
			),
		).toBe("Finished · Updated 38 assets · Methods Lab");
		expect(
			runSummary(
				run({
					state: "resolved",
					progress: {
						total: 1,
						done: 1,
						failed: 0,
					},
				}),
			),
		).toBe("Resolved · 1 file ready · Methods Lab");
		expect(
			runSummary(
				run({
					kind: "export",
					state: "expired",
					dataExport: {
						id: "export-1" as DataExportId,
						status: "expired",
					},
				}),
			),
		).toBe("Expired · Download expired · Methods Lab");
	});

	test("a failed entry counts its failures only when it had several assets", () => {
		expect(
			runSummary(
				run({
					state: "failed",
					progress: {
						total: 40,
						done: 40,
						failed: 3,
					},
				}),
			),
		).toBe("Failed · 3 of 40 failed · Methods Lab");
		expect(
			runSummary(
				run({
					kind: "retry",
					asset,
					state: "failed",
					progress: {
						total: 1,
						done: 1,
						failed: 1,
					},
				}),
			),
		).toBe("Failed · Methods Lab");
	});
});

describe("runToast", () => {
	test("a finished upload gets a success toast with its outcome", () => {
		expect(
			runToast(
				run({
					state: "finished",
					repository,
					progress: {
						total: 40,
						done: 40,
						failed: 0,
					},
				}),
			),
		).toEqual({
			tone: "success",
			title: "Upload to Reading list finished",
			description: "40 files ready · Methods Lab",
		});
	});

	test("every failed entry gets an error toast", () => {
		expect(
			runToast(
				run({
					kind: "export",
					state: "failed",
				}),
			),
		).toEqual({
			tone: "error",
			title: "Data export failed",
			description: "Methods Lab",
		});
	});

	test("titles name the work that ended", () => {
		const titleOf = (overrides: Partial<ActivityRun>) =>
			runToast(
				run({
					state: "failed",
					...overrides,
				}),
			)?.title;
		expect(titleOf({})).toBe("Upload to Library failed");
		expect(
			titleOf({
				kind: "fill_metadata",
				state: "finished",
			}),
		).toBe("Metadata generation finished");
		expect(
			titleOf({
				kind: "suggest_metadata",
				asset,
			}),
		).toBe(`Metadata suggestion for ${asset.title} failed`);
		expect(
			titleOf({
				kind: "retry",
				asset,
			}),
		).toBe(`Preparation of ${asset.title} failed`);
		expect(
			titleOf({
				kind: "retry",
				repository,
			}),
		).toBe(`Preparation in ${repository.name} failed`);
		expect(
			titleOf({
				kind: "export",
				state: "finished",
			}),
		).toBe("Data export finished");
	});

	test("finished work on a single asset gets none", () => {
		const single = {
			total: 1,
			done: 1,
			failed: 0,
		};
		expect(
			runToast(
				run({
					kind: "retry",
					asset,
					state: "finished",
					progress: single,
				}),
			),
		).toBeNull();
		expect(
			runToast(
				run({
					kind: "suggest_metadata",
					asset,
					state: "finished",
					progress: single,
				}),
			),
		).toBeNull();
	});

	test("speaks German", () => {
		overwriteGetLocale(() => "de");
		expect(
			runToast(
				run({
					kind: "fill_metadata",
					state: "finished",
					metadata: {
						updated: 1,
						unchanged: 0,
					},
				}),
			),
		).toEqual({
			tone: "success",
			title: "Metadatenerzeugung abgeschlossen",
			description: "1 Asset aktualisiert · Methods Lab",
		});
	});
});

describe("activityLabel", () => {
	test("states what runs and what needs the user", () => {
		expect(
			activityLabel({
				running: 2,
				attention: 9,
			}),
		).toBe("Activity, 2 running, 9 need your attention");
		expect(
			activityLabel({
				running: 0,
				attention: 1,
			}),
		).toBe("Activity, 1 needs your attention");
		expect(
			activityLabel({
				running: 0,
				attention: 0,
			}),
		).toBe("Activity");
	});

	test("in German", () => {
		overwriteGetLocale(() => "de");
		expect(
			activityLabel({
				running: 1,
				attention: 2,
			}),
		).toBe("Aktivität, 1 läuft, 2 benötigen Ihre Aufmerksamkeit");
	});
});

describe("failures", () => {
	const failure = (overrides: Partial<ActivityFailure>): ActivityFailure => ({
		occurrenceId: "00000000-0000-4000-8000-000000000000",
		stage: "processing",
		failure: "extraction",
		asset: {
			id: "asset-2" as AssetId,
			title: "scan-1987.pdf",
		},
		repository: null,
		dataExportId: null,
		organization,
		...overrides,
	});

	test("say what was not done, to what", () => {
		expect(failureTitle(failure({}))).toBe("scan-1987.pdf was not prepared");
		expect(
			failureTitle(
				failure({
					stage: "indexing",
					repository,
				}),
			),
		).toBe("scan-1987.pdf was not indexed in Reading list");
		expect(
			failureTitle(
				failure({
					stage: "metadata",
				}),
			),
		).toBe("No metadata was generated for scan-1987.pdf");
		expect(
			failureTitle(
				failure({
					stage: "export",
					asset: null,
				}),
			),
		).toBe("Your data was not exported");
	});

	test("give the organisation and the reason when known", () => {
		expect(failureSummary(failure({}))).toBe(
			"Methods Lab · The file could not be read.",
		);
		expect(
			failureSummary(
				failure({
					failure: null,
				}),
			),
		).toBe("Methods Lab");
	});
});

describe("memberStage", () => {
	const member = (overrides: Partial<ActivityMember>): ActivityMember => ({
		asset,
		processing: null,
		metadata: null,
		indexing: null,
		appliedFields: null,
		...overrides,
	});

	test("a failure wins, then the earliest pending stage", () => {
		expect(
			memberStage(
				member({
					processing: "completed",
					indexing: "failed",
					metadata: "pending",
				}),
			),
		).toBe("failed");
		expect(
			memberStage(
				member({
					processing: "pending",
					indexing: "pending",
				}),
			),
		).toBe("processing");
		expect(
			memberStage(
				member({
					processing: "completed",
					indexing: "pending",
				}),
			),
		).toBe("indexing");
	});

	test("a metadata run tells updated from unchanged", () => {
		expect(
			memberStage(
				member({
					metadata: "completed",
					appliedFields: [
						"description",
					],
				}),
			),
		).toBe("updated");
		expect(
			memberStage(
				member({
					metadata: "completed",
					appliedFields: [],
				}),
			),
		).toBe("unchanged");
	});

	test("finished work is ready, work taken over is stopped", () => {
		expect(
			memberStage(
				member({
					processing: "completed",
					indexing: "replaced",
				}),
			),
		).toBe("ready");
		expect(
			memberStage(
				member({
					indexing: "replaced",
				}),
			),
		).toBe("stopped");
		expect(memberStage(member({}))).toBeNull();
	});
});

describe("fieldSummary", () => {
	test("lists the fields by count, then the unchanged assets", () => {
		expect(
			fieldSummary(
				{
					language: 31,
					description: 38,
					author: 12,
				},
				4,
			),
		).toBe("Description 38 · Language 31 · Author(s) 12 · 4 unchanged");
		expect(
			fieldSummary(
				{
					description: 2,
				},
				0,
			),
		).toBe("Description 2");
	});
});
