import type { FeatureId } from "@orcai/schema";
import { m } from "@/paraglide/messages";

export const featureLabel = (id: FeatureId): string => {
	switch (id) {
		case "generativeUi":
			return m.feature_generative_ui_label();
	}
};

export const featureDescription = (id: FeatureId): string => {
	switch (id) {
		case "generativeUi":
			return m.feature_generative_ui_description();
	}
};
