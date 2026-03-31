import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export const RenameDialog = ({
	open,
	onOpenChange,
	initialValue,
	entityLabel,
	onSubmit,
	isSubmitting = false,
	maxLength = 250,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	initialValue: string | null;
	entityLabel: string;
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

	const normalizedEntityLabel = entityLabel.toLowerCase();
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
						<DialogTitle>Rename {entityLabel}</DialogTitle>
						<DialogDescription>
							Enter a new name for this {normalizedEntityLabel}.
						</DialogDescription>
					</DialogHeader>
					<Input
						autoFocus
						placeholder={`New ${normalizedEntityLabel} name`}
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
							Cancel
						</Button>
						<Button type="submit" disabled={isSubmitting || !trimmedValue}>
							{isSubmitting ? "Renaming..." : "Rename"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
};
