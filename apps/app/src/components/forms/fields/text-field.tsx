import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { type ControlWidth, FormField, useFormField } from "./form-field";

/** Numbers are right-aligned at a number width unless told otherwise. */
const TextField = ({
	label,
	description,
	unit,
	width,
	type = "text",
	className,
	...props
}: {
	label: string;
	description?: string;
	unit?: string;
	width?: ControlWidth;
} & React.ComponentProps<"input">) => {
	const { field, ...state } = useFormField<string | number | undefined>(
		label,
		description,
	);
	const isNumber = type === "number";

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value;
		if (isNumber) {
			field.handleChange(value === "" ? undefined : Number(value));
		} else {
			field.handleChange(value);
		}
	};

	return (
		<FormField
			state={state}
			label={label}
			description={description}
			width={width ?? (isNumber ? "number" : "full")}
		>
			<div className="relative">
				<Input
					{...props}
					{...state.control}
					type={type}
					name={field.name}
					value={field.state.value ?? ""}
					onBlur={field.handleBlur}
					onChange={handleChange}
					className={cn(
						isNumber &&
							"text-right tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
						unit && "pr-16",
						className,
					)}
				/>
				{unit && (
					<span className="pointer-events-none absolute inset-y-0 right-0 flex min-w-14 items-center justify-center border-l px-2 font-mono text-muted-foreground text-xs">
						{unit}
					</span>
				)}
			</div>
		</FormField>
	);
};

export default TextField;
