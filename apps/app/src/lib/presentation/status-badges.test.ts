import { beforeAll, describe, expect, test } from "bun:test";
import { m } from "@/paraglide/messages";
import { overwriteGetLocale } from "@/paraglide/runtime";
import { assetStateBadge } from "./asset-state";
import { modelStatusBadge } from "./model-status";
import { processingStatusBadge } from "./processing-status";
import { providerStatusBadge } from "./provider-status";
import { publicationStatusBadge } from "./publication-status";
import { quotaPoolStatusBadge } from "./quota-pool-status";
import { RESOURCE_KINDS } from "./resource-kind";

beforeAll(() => {
	overwriteGetLocale(() => "en");
});

describe("providerStatusBadge", () => {
	test("an enabled provider is success, a disabled one secondary", () => {
		expect(providerStatusBadge(true)).toEqual({
			label: m.common_status_enabled_label(),
			variant: "success",
		});
		expect(providerStatusBadge(false)).toEqual({
			label: m.common_status_disabled_label(),
			variant: "secondary",
		});
	});
});

describe("quotaPoolStatusBadge", () => {
	test("an active pool is success, an inactive one secondary", () => {
		expect(quotaPoolStatusBadge(true)).toEqual({
			label: m.common_status_active_label(),
			variant: "success",
		});
		expect(quotaPoolStatusBadge(false)).toEqual({
			label: m.common_status_inactive_label(),
			variant: "secondary",
		});
	});
});

describe("modelStatusBadge", () => {
	test("a deprecated model warns, any other is success", () => {
		expect(modelStatusBadge(true)).toEqual({
			label: m.common_status_deprecated_label(),
			variant: "warning",
		});
		expect(modelStatusBadge(false)).toEqual({
			label: m.common_status_active_label(),
			variant: "success",
		});
	});
});

describe("publicationStatusBadge", () => {
	test("a published item is success, a draft outline", () => {
		expect(publicationStatusBadge("ready")).toEqual({
			label: m.common_status_ready_label(),
			variant: "success",
		});
		expect(publicationStatusBadge("draft")).toEqual({
			label: m.common_status_draft_label(),
			variant: "outline",
		});
	});
});

describe("assetStateBadge", () => {
	test("labels and colours every state, spinning while work runs", () => {
		expect(assetStateBadge("queued", true)).toMatchObject({
			label: m.asset_state_queued_label(),
			variant: "info",
			icon: undefined,
		});
		expect(assetStateBadge("processing", true)).toMatchObject({
			label: m.asset_state_processing_label(),
			variant: "processing",
			className: "[&>svg]:animate-spin",
		});
		expect(assetStateBadge("indexing", true)).toMatchObject({
			label: m.asset_state_indexing_label(),
			variant: "processing",
			className: "[&>svg]:animate-spin",
		});
		expect(assetStateBadge("ready", true)).toMatchObject({
			label: m.asset_state_ready_label(),
			variant: "success",
			icon: undefined,
		});
		expect(assetStateBadge("failed", true)).toMatchObject({
			label: m.asset_state_failed_label(),
			variant: "danger",
			icon: undefined,
		});
	});

	test("indexing waits for the embedding setup until it exists", () => {
		expect(assetStateBadge("indexing", false)).toEqual({
			label: m.asset_state_waiting_for_embeddings_label(),
			variant: "info",
		});
	});
});

describe("processingStatusBadge", () => {
	test("shows the asset state each pipeline status stands for", () => {
		expect(processingStatusBadge("pending")).toEqual(
			assetStateBadge("queued", true),
		);
		expect(processingStatusBadge("active")).toEqual(
			assetStateBadge("processing", true),
		);
		expect(processingStatusBadge("completed")).toEqual(
			assetStateBadge("ready", true),
		);
		expect(processingStatusBadge("failed")).toEqual(
			assetStateBadge("failed", true),
		);
	});
});

describe("RESOURCE_KINDS", () => {
	test("labels every kind with its glossary term", () => {
		expect(
			Object.fromEntries(
				Object.entries(RESOURCE_KINDS).map(([kind, { label }]) => [
					kind,
					label(),
				]),
			),
		).toEqual({
			bot: m.resource_kind_bot(),
			behaviour: m.resource_kind_behaviour(),
			repository: m.resource_kind_repository(),
			asset: m.resource_kind_asset(),
		});
	});
});
