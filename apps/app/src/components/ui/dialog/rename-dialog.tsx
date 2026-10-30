import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { m } from "@/paraglide/messages";

export const RenameDialog = ({
	open,
	onOpenChange,
	initialValue,
	copy,
	onSubmit,
	isSubmitting = false,
	maxLength = 250,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	initialValue: string | null;
	copy: {
		title: string;
		placeholder: string;
		submit: string;
	};
	onSubmit: (value: string) => Promise<void> | void;
	isSubmitting?: boolean;
	maxLength?: number;
}) => {
	const [value, setValue] = useState(initialValue ?? "");

	useEffect(() => {
		if (open) {
			setValue(initialValue ?? "");
		}
	}, [
		initialValue,
		open,
	]);

	const trimmedValue = value.trim();

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<form
					onSubmit={async (event) => {
						event.preventDefault();

						if (!trimmedValue) {
							return;
						}

						await onSubmit(trimmedValue);
					}}
					className="space-y-4"
				>
					<DialogHeader>
						<DialogTitle>{copy.title}</DialogTitle>
					</DialogHeader>
					<Input
						autoFocus
						placeholder={copy.placeholder}
						value={value}
						onChange={(event) => setValue(event.target.value)}
						maxLength={maxLength}
						required
					/>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={isSubmitting}
						>
							{m.common_cancel_button()}
						</Button>
						<Button
							type="submit"
							loading={isSubmitting}
							disabled={!trimmedValue}
						>
							{copy.submit}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
};
