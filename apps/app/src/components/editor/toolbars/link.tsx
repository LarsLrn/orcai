import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import type { VariantProps } from "class-variance-authority";
import { Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { getUrlFromString } from "@/components/editor/utils";
import { Button, type buttonVariants } from "@/components/ui/button";
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
import { useToolbar } from "./toolbar-provider";

const LinkToolbar = ({
	className,
	...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants>) => {
	const { editor } = useToolbar();
	const [link, setLink] = useState("");

	const handleConfirm = () => {
		const url = getUrlFromString(link);
		url &&
			editor
				?.chain()
				.focus()
				.setLink({
					href: url,
				})
				.run();
	};

	useEffect(() => {
		setLink(editor?.getAttributes("link").href ?? "");
	}, [
		editor,
	]);

	return (
		<Popover>
			<Tooltip>
				<TooltipTrigger
					render={
						<PopoverTrigger
							disabled={
								!editor
									?.can()
									.chain()
									.setLink({
										href: "",
									})
									.run()
							}
							render={
								<Button
									variant="ghost"
									size="sm"
									className={cn(
										"h-8 w-max px-3 font-normal",
										editor?.isActive("link") && "bg-accent",
										className,
									)}
									{...props}
								>
									<p className="mr-2 text-base">↗</p>
									<p
										className={"underline decoration-gray-7 underline-offset-4"}
									>
										{m.editor_toolbar_link_button()}
									</p>
								</Button>
							}
						/>
					}
				/>
				<TooltipContent>
					<span>{m.editor_toolbar_link_tooltip()}</span>
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
							<Label>{m.editor_toolbar_link_popover_label()}</Label>
							<p className="text-gray-11 text-sm">
								{m.editor_toolbar_link_popover_description()}
							</p>
							<div className="mt-3 flex flex-col items-end justify-end gap-3">
								<Input
									value={link}
									onChange={(e) => {
										setLink(e.target.value);
									}}
									className="w-full"
									placeholder="https://example.com"
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											handleConfirm();
										}
									}}
								/>
								<div className="flex items-center gap-3">
									{editor?.getAttributes("link").href && (
										<Button
											size="sm"
											className="h-8 text-gray-11"
											variant="ghost"
											onClick={() => {
												editor?.chain().focus().unsetLink().run();
												setLink("");
											}}
										>
											<Trash2 />
											{m.common_remove_button()}
										</Button>
									)}
									<Button size="sm" className="h-8" onClick={handleConfirm}>
										{editor?.getAttributes("link").href
											? m.editor_toolbar_link_update_button()
											: m.common_confirm_button()}
									</Button>
								</div>
							</div>
						</div>
					</div>
				}
			/>
		</Popover>
	);
};

export { LinkToolbar };
