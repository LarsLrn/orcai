import { useSelector } from "@tanstack/react-store";
import { format } from "date-fns";
import { CalendarIcon, XIcon } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { useFieldContext } from "@/hooks/form/context";
import { useFieldLabel } from "@/hooks/form/field-labels";
import { getDateLocale } from "@/lib/presentation/date-locale";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

type DatetimeFieldProps = {
	label: string;
	placeholder?: string;
	description?: string;
	showTimePicker?: boolean;
	showClearButton?: boolean;
	minDate?: Date;
	maxDate?: Date;
};

const DatetimeField = ({
	label,
	placeholder = m.forms_datetime_field_placeholder(),
	description,
	showTimePicker = false,
	showClearButton = false,
	minDate,
	maxDate,
}: DatetimeFieldProps) => {
	const field = useFieldContext<Date | null>();
	useFieldLabel(field, label);
	const id = useId();

	const errors = useSelector(field.store, (state) => state.meta.errors);
	const isInvalid = useSelector(
		field.store,
		(state) => state.meta.isTouched && !state.meta.isValid,
	);

	const value = field.state.value;

	const formatDate = (date: Date) =>
		format(date, showTimePicker ? "PPPp" : "PPP", {
			locale: getDateLocale(),
		});

	const handleDateSelect = (selectedDate: Date | undefined) => {
		if (!selectedDate) {
			field.handleChange(null);
			return;
		}

		let newDate = selectedDate;

		// Preserve time if showing time picker and we have an existing value
		if (value && showTimePicker) {
			newDate = new Date(selectedDate);
			newDate.setHours(value.getHours());
			newDate.setMinutes(value.getMinutes());
			newDate.setSeconds(value.getSeconds());
		}

		field.handleChange(newDate);
	};

	const handleTimeChange = (timeString: string) => {
		const [hours, minutes, seconds = "00"] = timeString.split(":");
		const parsedHours = Number.parseInt(hours, 10);
		const parsedMinutes = Number.parseInt(minutes, 10);
		const parsedSeconds = Number.parseInt(seconds, 10);

		if (!value) {
			// If no date selected, use today
			const today = new Date();
			today.setHours(parsedHours, parsedMinutes, parsedSeconds);
			field.handleChange(today);
			return;
		}

		const newDate = new Date(value);
		newDate.setHours(parsedHours, parsedMinutes, parsedSeconds);
		field.handleChange(newDate);
	};

	const getTimeValue = () => {
		if (!value) return "";
		const hours = value.getHours().toString().padStart(2, "0");
		const minutes = value.getMinutes().toString().padStart(2, "0");
		const seconds = value.getSeconds().toString().padStart(2, "0");
		return `${hours}:${minutes}:${seconds}`;
	};

	return (
		<Field data-invalid={isInvalid}>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			<Popover>
				<div className="flex gap-2">
					<PopoverTrigger
						render={
							<Button
								id={id}
								variant="outline"
								className={cn(
									"min-w-0 flex-1 justify-start text-left font-normal",
									!value && "text-muted-foreground",
								)}
								aria-invalid={isInvalid}
							>
								{value ? formatDate(value) : <span>{placeholder}</span>}
								<CalendarIcon
									className="ml-auto h-4 w-4 opacity-50"
									aria-hidden="true"
								/>
							</Button>
						}
					/>
					{showClearButton && value && (
						<Button
							type="button"
							variant="outline"
							size="icon"
							aria-label={m.forms_datetime_field_clear_aria_label()}
							onClick={() => field.handleChange(null)}
						>
							<XIcon className="h-4 w-4 opacity-50" aria-hidden="true" />
						</Button>
					)}
				</div>
				<PopoverContent className="w-auto p-0" align="start">
					<div className="flex">
						<div className="flex flex-col">
							<div className="p-3 pb-0">
								<Label className="px-1 font-medium text-sm">
									{m.forms_datetime_field_date_label()}
								</Label>
							</div>
							<Calendar
								mode="single"
								selected={value ?? undefined}
								onSelect={handleDateSelect}
								disabled={(date) => {
									if (minDate && date < minDate) return true;
									if (maxDate && date > maxDate) return true;
									return false;
								}}
								captionLayout="dropdown"
								autoFocus
							/>
						</div>
						{showTimePicker && (
							<div className="border-border border-l">
								<div className="flex flex-col gap-3 p-3">
									<Label
										htmlFor={`${id}-time`}
										className="px-1 font-medium text-sm"
									>
										{m.forms_datetime_field_time_label()}
									</Label>
									<Input
										id={`${id}-time`}
										type="time"
										step="1"
										value={getTimeValue()}
										onChange={(e) => handleTimeChange(e.target.value)}
										className="w-32 appearance-none bg-background [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
									/>
								</div>
							</div>
						)}
					</div>
				</PopoverContent>
			</Popover>
			{description && <FieldDescription>{description}</FieldDescription>}
			{isInvalid && <FieldError errors={errors} />}
		</Field>
	);
};

export default DatetimeField;
