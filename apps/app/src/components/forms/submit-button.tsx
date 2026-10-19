import { useSelector } from "@tanstack/react-store";
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
	const isSubmitting = useSelector(form.store, (state) => state.isSubmitting);

	return (
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
	);
};

export { SubmitButton };
