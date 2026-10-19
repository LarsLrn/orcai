import type { VariantProps } from "class-variance-authority";
import { Button, type buttonVariants } from "@/components/ui/button";
import { useFormContext } from "@/hooks/form/context";

const SubmitButton = ({
	label,
	className,
	variant,
	size,
	disabled,
	...props
}: {
	label: string;
} & React.ComponentProps<"button"> &
	VariantProps<typeof buttonVariants>) => {
	const form = useFormContext();
	return (
		<form.Subscribe selector={(state) => state.isSubmitting}>
			{(isSubmitting) => (
				<Button
					type="submit"
					variant={variant}
					size={size}
					loading={isSubmitting}
					disabled={disabled}
					className={className}
					{...props}
				>
					{label}
				</Button>
			)}
		</form.Subscribe>
	);
};

export { SubmitButton };
