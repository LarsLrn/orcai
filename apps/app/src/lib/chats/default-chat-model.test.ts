import { describe, expect, test } from "bun:test";
import type { ModelId, ProviderId } from "@orcai/core";
import type { QuotaScope } from "@orcai/quota";
import {
	chatModelPrecedence,
	type OrganizationChatModel,
} from "./default-chat-model";

const providerId = crypto.randomUUID() as ProviderId;
const otherProviderId = crypto.randomUUID() as ProviderId;
const modelOf = (
	usable = true,
	provider: ProviderId = providerId,
): OrganizationChatModel => ({
	modelId: crypto.randomUUID() as ModelId,
	providerId: provider,
	usable,
});
const covering = (...models: OrganizationChatModel[]): QuotaScope[] =>
	models.map(({ modelId, providerId }) => ({
		modelId,
		providerId,
	}));
const choiceOf = ({ modelId, providerId }: OrganizationChatModel) => ({
	modelId,
	providerId,
});

describe("chatModelPrecedence", () => {
	const first = modelOf();
	const recommended = modelOf();
	const organizationDefault = modelOf();
	const models = [
		first,
		recommended,
		organizationDefault,
	];

	test("a covered recommendation comes first", () => {
		expect(
			chatModelPrecedence({
				recommendedModelId: recommended.modelId,
				defaultModelId: organizationDefault.modelId,
				models,
				scopes: covering(...models),
			}),
		).toEqual(choiceOf(recommended));
	});

	test("an uncovered recommendation gives way to a covered default", () => {
		expect(
			chatModelPrecedence({
				recommendedModelId: recommended.modelId,
				defaultModelId: organizationDefault.modelId,
				models,
				scopes: covering(first, organizationDefault),
			}),
		).toEqual(choiceOf(organizationDefault));
	});

	test("an uncovered default gives way to the first covered model in list order", () => {
		const covered = modelOf();
		expect(
			chatModelPrecedence({
				recommendedModelId: null,
				defaultModelId: organizationDefault.modelId,
				models: [
					first,
					covered,
					organizationDefault,
				],
				scopes: covering(covered),
			}),
		).toEqual(choiceOf(covered));
	});

	test("unusable models are skipped, covered or not", () => {
		const unusable = modelOf(false);
		expect(
			chatModelPrecedence({
				recommendedModelId: unusable.modelId,
				defaultModelId: unusable.modelId,
				models: [
					unusable,
					first,
				],
				scopes: covering(unusable, first),
			}),
		).toEqual(choiceOf(first));
	});

	test("ids that are not the organisation's models are skipped", () => {
		expect(
			chatModelPrecedence({
				recommendedModelId: crypto.randomUUID() as ModelId,
				defaultModelId: crypto.randomUUID() as ModelId,
				models,
				scopes: covering(...models),
			}),
		).toEqual(choiceOf(first));
	});

	test("a pool for the whole provider covers each of its models", () => {
		const elsewhere = modelOf(true, otherProviderId);
		expect(
			chatModelPrecedence({
				recommendedModelId: null,
				defaultModelId: organizationDefault.modelId,
				models: [
					elsewhere,
					organizationDefault,
				],
				scopes: [
					{
						providerId: otherProviderId,
						modelId: null,
					},
				],
			}),
		).toEqual(choiceOf(elsewhere));
	});

	test("without a covered model, the first usable one in precedence order", () => {
		expect(
			chatModelPrecedence({
				recommendedModelId: recommended.modelId,
				defaultModelId: organizationDefault.modelId,
				models,
				scopes: [],
			}),
		).toEqual(choiceOf(recommended));
	});

	test("without a usable model, none", () => {
		expect(
			chatModelPrecedence({
				recommendedModelId: null,
				defaultModelId: null,
				models: [
					modelOf(false),
				],
				scopes: [],
			}),
		).toBeNull();
	});
});
