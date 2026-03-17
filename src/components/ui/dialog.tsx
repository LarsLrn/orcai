import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import type * as React from "react";
import { createContext, useContext } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DIALOG_BASE_Z_INDEX = 50;
const DIALOG_LAYER_STEP = 20;

const DialogLayerContext = createContext(0);

function useDialogLayer() {
	return useContext(DialogLayerContext);
}

function Dialog({ children, ...props }: DialogPrimitive.Root.Props) {
	const parentLayer = useDialogLayer();
	const layer = parentLayer + 1;

	return (
		<DialogLayerContext.Provider value={layer}>
			<DialogPrimitive.Root data-slot="dialog" {...props}>
				{children}
			</DialogPrimitive.Root>
		</DialogLayerContext.Provider>
	);
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
	return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
	return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
	return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
	className,
	style,
	...props
}: DialogPrimitive.Backdrop.Props) {
	const layer = useDialogLayer();
	const zIndex = DIALOG_BASE_Z_INDEX + layer * DIALOG_LAYER_STEP;

	return (
		<DialogPrimitive.Backdrop
			data-slot="dialog-overlay"
			className={cn(
				"data-open:fade-in-0 data-closed:fade-out-0 fixed inset-0 isolate bg-black/80 duration-100 data-closed:animate-out data-open:animate-in supports-backdrop-filter:backdrop-blur-xs",
				className,
			)}
			style={{
				...style,
				zIndex,
			}}
			{...props}
		/>
	);
}

function DialogContent({
	className,
	children,
	showCloseButton = true,
	style,
	...props
}: DialogPrimitive.Popup.Props & {
	showCloseButton?: boolean;
}) {
	const layer = useDialogLayer();
	const zIndex = DIALOG_BASE_Z_INDEX + layer * DIALOG_LAYER_STEP + 1;

	return (
		<DialogPortal>
			<DialogOverlay forceRender />
			<DialogPrimitive.Popup
				data-slot="dialog-content"
				className={cn(
					"data-open:fade-in-0 data-open:zoom-in-95 data-closed:fade-out-0 data-closed:zoom-out-95 fixed top-1/2 left-1/2 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-6 rounded-4xl bg-background p-6 text-sm outline-none ring-1 ring-foreground/5 duration-100 data-closed:animate-out data-open:animate-in sm:max-w-md",
					className,
				)}
				style={{
					...style,
					zIndex,
				}}
				{...props}
			>
				{children}
				{showCloseButton && (
					<DialogPrimitive.Close
						data-slot="dialog-close"
						render={
							<Button
								variant="secondary"
								className="absolute -top-2 -right-2 text-card hover:bg-secondary"
								size="icon-sm"
							/>
						}
					>
						<XIcon />
						<span className="sr-only">Close</span>
					</DialogPrimitive.Close>
				)}
			</DialogPrimitive.Popup>
		</DialogPortal>
	);
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="dialog-header"
			className={cn("flex flex-col gap-2", className)}
			{...props}
		/>
	);
}

function DialogFooter({
	className,
	showCloseButton = false,
	children,
	...props
}: React.ComponentProps<"div"> & {
	showCloseButton?: boolean;
}) {
	return (
		<div
			data-slot="dialog-footer"
			className={cn(
				"flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
				className,
			)}
			{...props}
		>
			{children}
			{showCloseButton && (
				<DialogPrimitive.Close render={<Button variant="outline" />}>
					Close
				</DialogPrimitive.Close>
			)}
		</div>
	);
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
	return (
		<DialogPrimitive.Title
			data-slot="dialog-title"
			className={cn("font-medium text-base leading-none", className)}
			{...props}
		/>
	);
}

function DialogDescription({
	className,
	...props
}: DialogPrimitive.Description.Props) {
	return (
		<DialogPrimitive.Description
			data-slot="dialog-description"
			className={cn(
				"text-muted-foreground text-sm *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
				className,
			)}
			{...props}
		/>
	);
}

export {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogOverlay,
	DialogPortal,
	DialogTitle,
	DialogTrigger,
};
