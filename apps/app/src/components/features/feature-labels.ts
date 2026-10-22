import type { FeatureId } from "@orcai/schema";
import { m } from "@/paraglide/messages";

export const featureLabel = (id: FeatureId): string => {
	switch (id) {
		case "generativeUi":
			return m.feature_generative_ui_label();
		case "webSearch":
			return m.feature_web_search_label();
		case "questions":
			return m.feature_questions_label();
	}
};

export const featureDescription = (id: FeatureId): string => {
	switch (id) {
		case "generativeUi":
			return m.feature_generative_ui_description();
		case "webSearch":
			return m.feature_web_search_description();
		case "questions":
			return m.feature_questions_description();
	}
};
