import { useSelector } from "@tanstack/react-store";
import { useId } from "react";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useFieldContext } from "@/hooks/form/context";
import { cn } from "@/lib/utils";

const TextField = ({
	label,
	description,
	unit,
	type = "text",
	...props
}: {
	label: string;
	description?: string;
	unit?: string;
} & React.ComponentProps<"input">) => {
	const field = useFieldContext<string | number>();
	const id = useId();

	const errors = useSelector(field.store, (state) => state.meta.errors);
	const isInvalid = useSelector(
		field.store,
		(state) => state.meta.isTouched && !state.meta.isValid,
	);

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value;
		if (type === "number") {
			field.handleChange(
				value === "" ? (undefined as unknown as number) : Number(value),
			);
		} else {
			field.handleChange(value);
		}
	};

	return (
		<Field data-invalid={isInvalid}>
			<FieldLabel className="font-bold" htmlFor={id}>
				{label}
			</FieldLabel>
			{description && <FieldDescription>{description}</FieldDescription>}
			<div className="relative">
				<Input
					id={id}
					type={type}
					name={field.name}
					value={field.state.value ?? ""}
					onBlur={field.handleBlur}
					onChange={handleChange}
					aria-invalid={isInvalid}
					className={cn(
						"[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
						unit && "pr-16",
						props.className,
					)}
					{...props}
				/>
				{unit && (
					<div className="absolute inset-y-0 right-0 flex cursor-pointer items-center pr-0">
						<div className="inline-flex h-full min-w-14 items-center justify-center whitespace-nowrap rounded-md rounded-l-none border-l p-1 font-mono text-muted-foreground text-sm">
							{unit}
						</div>
					</div>
				)}
			</div>
			{isInvalid && <FieldError errors={errors} />}
		</Field>
	);
};

export default TextField;
