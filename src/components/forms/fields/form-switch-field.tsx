import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import {
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type FormSwitchFieldProps<TFieldValues extends FieldValues = FieldValues> = {
	/** The react-hook-form instance */
	form: UseFormReturn<TFieldValues>;
	/** The name of the field (type-safe based on form schema) */
	name: Path<TFieldValues>;
	/** The label text for the form switch */
	label?: string;
	/** The description text for the form switch */
	description?: string;
	/** Whether the switch is disabled */
	disabled?: boolean;
	/** Whether the field is required (adds asterisk to label) */
	required?: boolean;
	/** Additional CSS class name for the component */
	className?: string;
};

function FormSwitchField<TFieldValues extends FieldValues = FieldValues>({
	form,
	name,
	label,
	description,
	disabled = false,
	required = false,
	className,
}: FormSwitchFieldProps<TFieldValues>) {
	return (
		<FormField
			control={form.control}
			name={name}
			render={({ field }) => (
				<FormItem>
					<div
						className={cn(
							className,
							"flex flex-row items-center justify-between gap-2 rounded-lg border p-4",
						)}
					>
						<div className="space-y-0.5">
							{label && (
								<FormLabel className="text-base" htmlFor="">
									{label}
									{required && (
										<span className="bold text-muted-foreground"> *</span>
									)}
								</FormLabel>
							)}
							{description && <FormDescription>{description}</FormDescription>}
						</div>
						<FormControl>
							<Switch
								checked={field.value}
								onCheckedChange={field.onChange}
								disabled={disabled}
							/>
						</FormControl>
					</div>
					<FormMessage />
				</FormItem>
			)}
		/>
	);
}

export { FormSwitchField };
