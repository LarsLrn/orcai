import { format } from "date-fns";
import { CalendarIcon, XIcon } from "lucide-react";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type FormDatetimeFieldProps<TFieldValues extends FieldValues = FieldValues> = {
	/** The react-hook-form instance */
	form: UseFormReturn<TFieldValues>;
	/** The name of the field (type-safe based on form schema) */
	name: Path<TFieldValues>;
	/** The placeholder string to display when no date is selected */
	placeholder: string;
	/** The label text for the form field */
	label?: string;
	/** The description text for the form field */
	description?: string;
	/** Whether to show a time picker input */
	showTimePicker?: boolean;
	/** Whether to show a clear button to clear the selected date */
	showClearButton?: boolean;
	/** The minimum selectable date */
	minDate?: Date;
	/** The maximum selectable date */
	maxDate?: Date;
	/** Whether the field is required (adds asterisk to label) */
	required?: boolean;
	/** Additional CSS class name for the component */
	className?: string;
};

function FormDatetimeField<TFieldValues extends FieldValues = FieldValues>({
	form,
	name,
	placeholder,
	label,
	description,
	showTimePicker = false,
	showClearButton = false,
	minDate = new Date("1900-01-01"),
	maxDate = new Date(),
	required = false,
	className,
}: FormDatetimeFieldProps<TFieldValues>) {
	return (
		<FormField
			control={form.control}
			name={name}
			render={({ field }) => {
				const formatDate = (date: Date) => {
					if (showTimePicker) {
						return format(date, "PPP 'at' p");
					}
					return format(date, "PPP");
				};

				const handleDateSelect = (selectedDate: Date | undefined) => {
					if (!selectedDate) {
						field.onChange(undefined);
						return;
					}

					let newDate = selectedDate;

					// If we have an existing value and we're showing time picker, preserve the time
					if (field.value && showTimePicker) {
						newDate = new Date(selectedDate);
						newDate.setHours(field.value.getHours());
						newDate.setMinutes(field.value.getMinutes());
						newDate.setSeconds(field.value.getSeconds());
					}

					field.onChange(newDate);
				};

				const handleTimeChange = (timeString: string) => {
					if (!field.value) {
						// If no date is selected, use today's date with the selected time
						const today = new Date();
						const [hours, minutes, seconds = "00"] = timeString.split(":");
						today.setHours(
							Number.parseInt(hours, 10),
							Number.parseInt(minutes, 10),
							Number.parseInt(seconds, 10),
						);
						field.onChange(today);
						return;
					}

					const newDate = new Date(field.value);
					const [hours, minutes, seconds = "00"] = timeString.split(":");
					newDate.setHours(
						Number.parseInt(hours, 10),
						Number.parseInt(minutes, 10),
						Number.parseInt(seconds, 10),
					);
					field.onChange(newDate);
				};

				const getTimeValue = () => {
					if (!field.value) return "";
					const hours = field.value.getHours().toString().padStart(2, "0");
					const minutes = field.value.getMinutes().toString().padStart(2, "0");
					const seconds = field.value.getSeconds().toString().padStart(2, "0");
					return `${hours}:${minutes}:${seconds}`;
				};

				return (
					<FormItem className={cn("flex flex-col", className)}>
						{label && (
							<FormLabel>
								{label}
								{required && (
									<span className="bold text-muted-foreground"> *</span>
								)}
							</FormLabel>
						)}
						<Popover>
							<PopoverTrigger asChild>
								<FormControl>
									<Button
										variant={"outline"}
										className={cn(
											"w-full pl-3 text-left font-normal",
											!field.value && "text-muted-foreground",
										)}
									>
										{field.value ? (
											formatDate(field.value)
										) : (
											<span>{placeholder}</span>
										)}
										<CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
										{showClearButton && field.value && (
											<XIcon
												className="ml-2 h-4 w-4 cursor-pointer opacity-50"
												onClick={(e) => {
													e.stopPropagation();
													field.onChange(null);
												}}
											/>
										)}
									</Button>
								</FormControl>
							</PopoverTrigger>
							<PopoverContent className="w-auto p-0" align="start">
								<div className="flex">
									<div className="flex flex-col">
										<div className="p-3 pb-0">
											<Label className="px-1 font-medium text-sm">Date</Label>
										</div>
										<Calendar
											mode="single"
											selected={field.value}
											onSelect={handleDateSelect}
											disabled={(date) => date > maxDate || date < minDate}
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
						{description && <FormDescription>{description}</FormDescription>}
						<FormMessage />
					</FormItem>
				);
			}}
		/>
	);
}

export { FormDatetimeField };
