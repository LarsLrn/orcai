import type { ModelId, ProviderId } from "@orcai/core";
import type { BotSetup, EffectiveModel } from "@orcai/schema";

/** How the composer's model picker behaves for a bot's setup. */
type ModelPickerState =
	| {
			kind: "free";
	  }
	| {
			/** A required model; its name is null once deleted. */
			kind: "locked";
			modelName: string | null;
	  }
	| {
			/** The user switched away from the recommended model. */
			kind: "tuned";
			modelName: string;
	  };

const modelPickerState = ({
	source,
	modelId,
	botSetup,
}: Pick<
	EffectiveModel,
	"source" | "modelId" | "botSetup"
>): ModelPickerState => {
	if (source === "bot-required") {
		return {
			kind: "locked",
			modelName: botSetup?.model?.name ?? null,
		};
	}
	if (
		botSetup?.strength === "recommended" &&
		botSetup.model &&
		modelId !== botSetup.model.id
	) {
		return {
			kind: "tuned",
			modelName: botSetup.model.name,
		};
	}
	return {
		kind: "free",
	};
};

type ModelChoice = {
	modelId: ModelId;
	providerId: ProviderId;
};

/**
 * The model a new chat starts on: a required one is fixed, otherwise the
 * user's pick, then the default, which already weighs a recommendation.
 */
const starterModel = ({
	setup,
	picked,
	defaultModel,
}: {
	setup: BotSetup | null;
	picked: ModelChoice | null;
	defaultModel: ModelChoice | null;
}): ModelChoice | undefined => {
	if (setup?.strength === "required") {
		return setup.model
			? {
					modelId: setup.model.id,
					providerId: setup.model.providerId,
				}
			: undefined;
	}
	return picked ?? defaultModel ?? undefined;
};

export {
	type ModelChoice,
	type ModelPickerState,
	modelPickerState,
	starterModel,
};
