import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import { useSelector } from "@tanstack/react-store";
import { useId, useMemo } from "react";
import {
	Combobox,
	ComboboxChip,
	ComboboxChips,
	ComboboxChipsInput,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInputGroup,
	ComboboxItem,
	ComboboxList,
	ComboboxTrigger,
	ComboboxValue,
} from "@/components/ui/combobox";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldError,
	FieldLabel,
} from "@/components/ui/field";
import { useFieldContext } from "@/hooks/form/context";
import { useFieldLabel } from "@/hooks/form/field-labels";
import { m } from "@/paraglide/messages";

interface MultiSelectOption {
	value: string;
	label: string;
	/** A muted second line under the label in the list. */
	hint?: string;
}

const MultiSelectField = ({
	label,
	options,
	description,
	placeholder = m.forms_multi_select_field_placeholder(),
	disabled,
}: {
	label: string;
	options: MultiSelectOption[];
	description?: string;
	placeholder?: string;
	disabled?: boolean;
}) => {
	const field = useFieldContext<string[]>();
	useFieldLabel(field, label);
	const id = useId();

	const errors = useSelector(field.store, (state) => state.meta.errors);
	const isInvalid = useSelector(
		field.store,
		(state) => state.meta.isTouched && !state.meta.isValid,
	);

	const items = useMemo(
		() =>
			ComboboxPrimitive.createItems(options, {
				getValue: (option) => option.value,
				getLabel: (option) => option.label,
			}),
		[
			options,
		],
	);
	const labels = useMemo(
		() =>
			new Map(
				options.map((option) => [
					option.value,
					option.label,
				]),
			),
		[
			options,
		],
	);

	const descriptionId = description ? `${id}-description` : undefined;
	const errorId = isInvalid ? `${id}-error` : undefined;
	const selectedCount = field.state.value.length;
	const keyboardHintId = selectedCount > 0 ? `${id}-keyboard` : undefined;
	const describedBy =
		[
			descriptionId,
			errorId,
			keyboardHintId,
		]
			.filter(Boolean)
			.join(" ") || undefined;

	return (
		<Field data-invalid={isInvalid}>
			<FieldContent>
				<FieldLabel htmlFor={id}>{label}</FieldLabel>
				{description && (
					<FieldDescription id={descriptionId}>{description}</FieldDescription>
				)}
				{isInvalid && <FieldError id={errorId} errors={errors} />}
			</FieldContent>
			<Combobox
				items={items}
				multiple
				value={field.state.value}
				onValueChange={field.handleChange}
				onOpenChange={(open, details) => {
					if (!open && details.reason === "item-press") details.cancel();
				}}
				disabled={disabled || options.length === 0}
			>
				<ComboboxInputGroup>
					<ComboboxChips>
						<ComboboxValue>
							{(value: string[]) => (
								<>
									{value.map((optionValue) => {
										const optionLabel = labels.get(optionValue) ?? optionValue;
										return (
											<ComboboxChip
												key={optionValue}
												aria-label={optionLabel}
												aria-description={m.multi_select_chip_description()}
												removeLabel={m.multi_select_remove_option_label({
													label: optionLabel,
												})}
											>
												{optionLabel}
											</ComboboxChip>
										);
									})}
									<ComboboxChipsInput
										id={id}
										onBlur={field.handleBlur}
										aria-invalid={isInvalid}
										aria-describedby={describedBy}
										placeholder={value.length > 0 ? "" : placeholder}
									/>
								</>
							)}
						</ComboboxValue>
					</ComboboxChips>
					<ComboboxTrigger aria-label={m.multi_select_show_options()} />
				</ComboboxInputGroup>
				<ComboboxContent>
					<ComboboxEmpty>{m.multi_select_empty_state()}</ComboboxEmpty>
					<ComboboxList>
						{(option: MultiSelectOption) => (
							<ComboboxItem key={option.value} value={option.value}>
								<span className="block truncate">{option.label}</span>
								{option.hint ? (
									<span className="block truncate text-muted-foreground text-xs">
										{option.hint}
									</span>
								) : null}
							</ComboboxItem>
						)}
					</ComboboxList>
				</ComboboxContent>
			</Combobox>
			{keyboardHintId && (
				<span id={keyboardHintId} hidden>
					{m.multi_select_input_description({
						count: selectedCount,
					})}
				</span>
			)}
		</Field>
	);
};

export default MultiSelectField;
