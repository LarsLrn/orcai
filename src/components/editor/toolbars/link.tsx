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
import { useToolbar } from "./toolbar-provider";

const LinkToolbar = ({
	className,
	...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants>) => {
	const { editor } = useToolbar();
	const [link, setLink] = useState("");

	const handleConfirm = () => {
		const url = getUrlFromString(link);
		url && editor?.chain().focus().setLink({ href: url }).run();
	};

	useEffect(() => {
		setLink(editor?.getAttributes("link").href ?? "");
	}, [editor]);

	return (
		<Popover>
			<Tooltip>
				<TooltipTrigger
					render={
						<PopoverTrigger
							disabled={!editor?.can().chain().setLink({ href: "" }).run()}
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
										Link
									</p>
								</Button>
							}
						/>
					}
				/>
				<TooltipContent>
					<span>Link</span>
				</TooltipContent>
			</Tooltip>

			<PopoverContent
				className="relative px-3 py-2.5"
				render={
					<div className="relative">
						<PopoverPrimitive.Close
							className="absolute top-3 right-3"
							render={<X className="h-4 w-4" />}
						/>
						<div>
							<Label>Link</Label>
							<p className="text-gray-11 text-sm">
								Attach a link to the selected text
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
											<Trash2 className="mr-2 h-4 w-4" />
											Remove
										</Button>
									)}
									<Button size="sm" className="h-8" onClick={handleConfirm}>
										{editor?.getAttributes("link").href ? "Update" : "Confirm"}
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
