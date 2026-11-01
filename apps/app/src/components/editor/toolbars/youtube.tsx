import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import type { VariantProps } from "class-variance-authority";
import { SquarePlay, X } from "lucide-react";
import { useId, useState } from "react";
import { Button, type buttonVariants } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { youtubeEmbedUrl } from "../extensions/youtube";
import { useToolbar } from "./toolbar-provider";

const YoutubeToolbar = ({
	className,
	...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants>) => {
	const { editor } = useToolbar();
	const [open, setOpen] = useState(false);
	const [url, setUrl] = useState("");
	const inputId = useId();
	const errorId = useId();
	const src = youtubeEmbedUrl(url);
	const invalid = url.trim() !== "" && !src;

	const handleInsert = () => {
		if (!src) {
			return;
		}
		editor
			?.chain()
			.focus()
			.setYoutubeVideo({
				src,
			})
			.run();
		setOpen(false);
		setUrl("");
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<Tooltip>
				<TooltipTrigger
					render={
						<PopoverTrigger
							render={
								<Button
									type="button"
									variant="ghost"
									size="icon"
									aria-label={m.editor_toolbar_youtube_tooltip()}
									className={cn("h-8 w-8 p-0 sm:h-9 sm:w-9", className)}
									{...props}
								>
									<SquarePlay className="h-4 w-4" />
								</Button>
							}
						/>
					}
				/>
				<TooltipContent>
					<span>{m.editor_toolbar_youtube_tooltip()}</span>
				</TooltipContent>
			</Tooltip>

			<PopoverContent
				className="relative px-3 py-2.5"
				render={
					<div className="relative">
						<PopoverPrimitive.Close
							aria-label={m.common_close_button()}
							className="absolute top-3 right-3"
						>
							<X className="h-4 w-4" />
						</PopoverPrimitive.Close>
						<div>
							<Label htmlFor={inputId}>
								{m.editor_toolbar_youtube_popover_label()}
							</Label>
							<p className="text-gray-11 text-sm">
								{m.editor_toolbar_youtube_popover_description()}
							</p>
							<div className="mt-3 flex flex-col items-end justify-end gap-3">
								<Input
									id={inputId}
									value={url}
									onChange={(e) => {
										setUrl(e.target.value);
									}}
									className="w-full"
									placeholder="https://www.youtube.com/watch?v=…"
									aria-invalid={invalid || undefined}
									aria-describedby={invalid ? errorId : undefined}
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											e.preventDefault();
											handleInsert();
										}
									}}
								/>
								{invalid && (
									<FieldError id={errorId} className="w-full">
										{m.editor_toolbar_youtube_invalid_error()}
									</FieldError>
								)}
								<Button
									type="button"
									size="sm"
									className="h-8"
									disabled={!src}
									onClick={handleInsert}
								>
									{m.editor_toolbar_youtube_insert_button()}
								</Button>
							</div>
						</div>
					</div>
				}
			/>
		</Popover>
	);
};

export { YoutubeToolbar };
