import { useStore } from "@tanstack/react-form";
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
import { cn } from "@/lib/utils";

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
	placeholder = "Select a date",
	description,
	showTimePicker = false,
	showClearButton = false,
	minDate,
	maxDate,
}: DatetimeFieldProps) => {
	const field = useFieldContext<Date | null>();
	const id = useId();

	const errors = useStore(field.store, (state) => state.meta.errors);
	const isInvalid = useStore(
		field.store,
		(state) => state.meta.isTouched && !state.meta.isValid,
	);

	const value = field.state.value;

	const formatDate = (date: Date) => {
		if (showTimePicker) {
			return format(date, "PPP 'at' p");
		}
		return format(date, "PPP");
	};

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

	const handleClear = (e: React.MouseEvent) => {
		e.stopPropagation();
		field.handleChange(null);
	};

	return (
		<Field data-invalid={isInvalid}>
			<FieldLabel className="font-bold" htmlFor={id}>
				{label}
			</FieldLabel>
			<Popover>
				<PopoverTrigger
					render={
						<Button
							id={id}
							variant="outline"
							className={cn(
								"w-full justify-start text-left font-normal",
								!value && "text-muted-foreground",
							)}
							aria-invalid={isInvalid}
						>
							{value ? formatDate(value) : <span>{placeholder}</span>}
							<CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
							{showClearButton && value && (
								<XIcon
									className="ml-2 h-4 w-4 cursor-pointer opacity-50"
									onClick={handleClear}
								/>
							)}
						</Button>
					}
				/>
				<PopoverContent className="w-auto p-0" align="start">
					<div className="flex">
						<div className="flex flex-col">
							<div className="p-3 pb-0">
								<Label className="px-1 font-medium text-sm">Date</Label>
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
								initialFocus
							/>
						</div>
						{showTimePicker && (
							<div className="border-border border-l">
								<div className="flex flex-col gap-3 p-3">
									<Label className="px-1 font-medium text-sm">Time</Label>
									<Input
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
