import { type FeatureId, type Features, featureIdSchema } from "@orcai/schema";
import { useId } from "react";
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
			[id]: {},
		};
	}
	const { [id]: _removed, ...rest } = value;
	return rest;
};

/** Read-only when `onChange` is omitted. */
const FeaturesSection = ({
	value,
	onChange,
	disabled,
}: {
	value: Features;
	onChange?: (next: Features) => void;
	disabled?: boolean;
}) => {
	const id = useId();

	return (
		<FieldSet>
			<FieldLegend>{m.features_section_title()}</FieldLegend>
			<FieldDescription>{m.features_section_description()}</FieldDescription>
			<FieldGroup className="gap-3">
				{featureIdSchema.options.map((featureId) => {
					const switchId = `${id}-${featureId}`;
					return (
						<FieldLabel key={featureId} htmlFor={switchId}>
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
					);
				})}
			</FieldGroup>
		</FieldSet>
	);
};

export { FeaturesSection };
