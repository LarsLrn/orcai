import {
	type FeatureId,
	type Features,
	featureIdSchema,
	INITIAL_FEATURE_SETTINGS,
} from "@orcai/schema";
import { useId } from "react";
import { AllowedDomainsField } from "@/components/features/allowed-domains-field";
import {
	featureDescription,
	featureLabel,
} from "@/components/features/feature-labels";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
	FieldTitle,
} from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { m } from "@/paraglide/messages";

const setFeature = (
	value: Features,
	id: FeatureId,
	enabled: boolean,
): Features => {
	if (enabled) {
		return {
			...value,
			[id]: value[id] ?? INITIAL_FEATURE_SETTINGS[id],
		};
	}
	const { [id]: _removed, ...rest } = value;
	return rest;
};

/** Read-only when `onChange` is omitted; offers `ids`, every feature by default. */
const FeaturesSection = ({
	value,
	onChange,
	disabled,
	ids = featureIdSchema.options,
}: {
	value: Features;
	onChange?: (next: Features) => void;
	disabled?: boolean;
	ids?: readonly FeatureId[];
}) => {
	const id = useId();

	return (
		<FieldSet>
			<FieldLegend>{m.features_section_title()}</FieldLegend>
			<FieldDescription>{m.features_section_description()}</FieldDescription>
			<FieldGroup className="gap-3">
				{ids.map((featureId) => {
					const switchId = `${id}-${featureId}`;
					return (
						<div key={featureId} className="flex flex-col gap-3">
							<FieldLabel htmlFor={switchId}>
								<Field orientation="horizontal">
									<FieldContent>
										<FieldTitle id={`${switchId}-title`}>
											{featureLabel(featureId)}
										</FieldTitle>
										<FieldDescription id={`${switchId}-description`}>
											{featureDescription(featureId)}
										</FieldDescription>
									</FieldContent>
									<Switch
										id={switchId}
										checked={value[featureId] !== undefined}
										onCheckedChange={(checked) =>
											onChange?.(setFeature(value, featureId, checked))
										}
										readOnly={!onChange}
										disabled={disabled}
										aria-labelledby={`${switchId}-title`}
										aria-describedby={`${switchId}-description`}
									/>
								</Field>
							</FieldLabel>
							{featureId === "webSearch" && value.webSearch && (
								<div className="ps-4">
									<AllowedDomainsField
										value={value.webSearch.allowedDomains}
										onChange={
											onChange &&
											((allowedDomains) =>
												onChange({
													...value,
													webSearch: {
														allowedDomains,
													},
												}))
										}
										disabled={disabled}
									/>
								</div>
							)}
						</div>
					);
				})}
			</FieldGroup>
		</FieldSet>
	);
};

export { FeaturesSection };
