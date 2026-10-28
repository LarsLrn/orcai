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
 * The model a new chat starts on: a required one is fixed; otherwise the
 * user's pick, the recommended one while usable, then the default.
 */
const starterModel = ({
	setup,
	picked,
	defaultPick,
}: {
	setup: BotSetup | null;
	picked: ModelChoice | null;
	defaultPick: ModelChoice | null | undefined;
}): ModelChoice | undefined => {
	const setupModel = setup?.model && {
		modelId: setup.model.id,
		providerId: setup.model.providerId,
	};
	if (setup?.strength === "required") return setupModel ?? undefined;
	return (
		picked ??
		(setup?.model?.usable ? setupModel : undefined) ??
		defaultPick ??
		undefined
	);
};

export {
	type ModelChoice,
	type ModelPickerState,
	modelPickerState,
	starterModel,
};
