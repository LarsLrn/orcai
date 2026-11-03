/** Credit: https://github.com/Aslam97/react-confirm-dialog */

import {
	type ComponentProps,
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useRef,
	useState,
} from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Button } from "@/components/ui/button";
import { m } from "@/paraglide/messages";

export interface ConfirmOptions {
	title?: ReactNode;
	description?: ReactNode;
	contentSlot?: ReactNode;
	confirmText?: string;
	cancelText?: string;
	/** Destructive unless set. */
	confirmVariant?: ComponentProps<typeof Button>["variant"];
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | undefined>(undefined);

export const ConfirmDialogProvider = ({
	children,
}: {
	children: ReactNode;
}) => {
	const [dialog, setDialog] = useState<{
		open: boolean;
		options: ConfirmOptions;
	}>({
		open: false,
		options: {},
	});
	const resolver = useRef<((confirmed: boolean) => void) | null>(null);

	const confirm = useCallback<Confirm>((options) => {
		resolver.current?.(false);
		setDialog({
			open: true,
			options,
		});
		return new Promise((resolve) => {
			resolver.current = resolve;
		});
	}, []);

	const settle = (confirmed: boolean) => {
		resolver.current?.(confirmed);
		resolver.current = null;
		setDialog((prev) => ({
			...prev,
			open: false,
		}));
	};

	const {
		title,
		description,
		contentSlot,
		confirmText,
		cancelText,
		confirmVariant,
	} = dialog.options;

	return (
		<ConfirmContext.Provider value={confirm}>
			{children}
			<AlertDialog
				open={dialog.open}
				onOpenChange={(open) => {
					if (!open) settle(false);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						{title && <AlertDialogTitle>{title}</AlertDialogTitle>}
						{description && (
							<AlertDialogDescription>{description}</AlertDialogDescription>
						)}
						{contentSlot}
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel onClick={() => settle(false)}>
							{cancelText ?? m.common_cancel_button()}
						</AlertDialogCancel>
						<AlertDialogAction
							variant={confirmVariant ?? "destructive"}
							onClick={() => settle(true)}
						>
							{confirmText ?? m.common_confirm_button()}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</ConfirmContext.Provider>
	);
};

export const useConfirm = () => {
	const confirm = useContext(ConfirmContext);
	if (!confirm) {
		throw new Error("useConfirm must be used within a ConfirmDialogProvider");
	}
	return confirm;
};
