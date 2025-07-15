import type { JSONValue } from "ai";
import { ArrowUpRightIcon, CopyIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { toast } from "sonner";
import { useCopyToClipboard } from "usehooks-ts";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { DocumentMetadataType } from "@/db/schema/document";
import { useUmami } from "@/hooks/use-umami";
import { cn } from "@/lib/utils";

interface BaseAnnotation extends Record<string, JSONValue> {
	type: string;
}

interface AnnotationReference extends BaseAnnotation {
	id: string;
	title: string;
	metadata: DocumentMetadataType & JSONValue;
	type: "reference";
}

function isBaseAnnotation(value: JSONValue): value is BaseAnnotation {
	return (
		typeof value === "object" &&
		value !== null &&
		"type" in value &&
		typeof value.type === "string"
	);
}

const AnnotationBlock = ({
	annotations,
	className,
	...props
}: { annotations: JSONValue[] | undefined } & ComponentProps<"div">) => {
	const [, copy] = useCopyToClipboard();
	const { trackEvent } = useUmami();

	const handleCopy = (text: string | undefined) => {
		if (!text) {
			toast.error("No text to copy");
			return;
		}

		toast.promise(copy(text), {
			loading: "Copying...",
			success: "Copied!",
			error: "Failed to copy",
		});
	};

	if (!annotations || annotations.length <= 0) {
		return null;
	}

	return (
		<div className={cn("mt-4", className)} {...props}>
			<Accordion
				type="single"
				collapsible
				defaultValue={annotations.length <= 6 ? "item-1" : undefined}
			>
				<AccordionItem value="item-1">
					<AccordionTrigger className="py-2 font-bold text-md">
						References {annotations.length > 0 && `(${annotations.length})`}
					</AccordionTrigger>
					<AccordionContent className="flex flex-col gap-2">
						{annotations.map((annotation, i) => {
							// FIXME: Bit awkward. Check if there's a better way to do this.

							let typedAnnotation = annotation;

							if (!isBaseAnnotation(typedAnnotation)) {
								try {
									typedAnnotation = JSON.parse(annotation as string);
								} catch (error) {
									console.error("Error parsing annotation:", error);
									return;
								}
							}

							if (!isBaseAnnotation(typedAnnotation)) {
								return; // Skip annotations that don't match the expected structure
							}

							switch (typedAnnotation.type) {
								case "reference": {
									const referenceAnnotation =
										typedAnnotation as AnnotationReference;
									return (
										// biome-ignore lint/suspicious/noArrayIndexKey: <Needs improvement, but fine for now>
										<Popover key={i}>
											<PopoverTrigger className="inline-flex w-fit gap-2 rounded-md border bg-card p-1.5 text-left font-medium text-sm shadow-xs outline-none transition-all hover:bg-accent hover:text-accent-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:border-input dark:bg-input/30 dark:aria-invalid:ring-destructive/40 dark:hover:bg-input/50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0">
												<Badge
													variant="secondary"
													className="mr-1 inline-flex size-5 items-center justify-center overflow-clip rounded-full font-bold text-xs"
												>
													{i + 1}
												</Badge>
												<span className="wrap-anywhere line-clamp-1">
													{referenceAnnotation.title}
												</span>
											</PopoverTrigger>

											<PopoverContent
												className="w-full max-w-[400px] p-4"
												align="start"
											>
												<ScrollArea className="size-full pr-2">
													<div className="space-y-3">
														<div>
															<p className="text-muted-foreground text-xs">
																Title
															</p>
															<p className="font-medium text-sm">
																{referenceAnnotation.title}
															</p>
														</div>

														{referenceAnnotation.metadata.chapterTitle && (
															<div>
																<p className="text-muted-foreground text-xs">
																	Chapter
																</p>
																<p className="text-sm">
																	{referenceAnnotation.metadata.chapterTitle}
																	{referenceAnnotation.metadata.pageRange &&
																		` (pp. ${referenceAnnotation.metadata.pageRange})`}
																</p>
															</div>
														)}

														{referenceAnnotation.metadata.author && (
															<div>
																<p className="text-muted-foreground text-xs">
																	Author(s)
																</p>
																<p className="text-sm">
																	{referenceAnnotation.metadata.author}
																</p>
															</div>
														)}

														{referenceAnnotation.metadata.citation && (
															<div>
																<div className="flex items-center gap-2 text-muted-foreground text-xs">
																	<p>Citation</p>
																	<Button
																		variant="link"
																		className="size-4 p-0"
																		onClick={() =>
																			handleCopy(
																				referenceAnnotation.metadata.citation,
																			)
																		}
																	>
																		<CopyIcon className="size-2.5" />
																	</Button>
																</div>

																<p className="text-sm">
																	{referenceAnnotation.metadata.citation}
																</p>
															</div>
														)}

														{referenceAnnotation.metadata.externalUrl && (
															<div className="pt-2">
																<a
																	href={
																		referenceAnnotation.metadata.externalUrl
																	}
																	className="inline-flex items-center gap-1 font-medium text-primary text-sm hover:underline"
																	target="_blank"
																	onClick={() =>
																		trackEvent("annotation-source-click", {
																			target:
																				// biome-ignore lint/style/noNonNullAssertion: <Typescript doesn't get that we just checked this>
																				referenceAnnotation.metadata
																					.externalUrl!,
																			reference: referenceAnnotation.id,
																		})
																	}
																>
																	Source
																	<ArrowUpRightIcon size={16} />
																</a>
															</div>
														)}
													</div>
												</ScrollArea>
											</PopoverContent>
										</Popover>
									);
								}
								default:
									return null;
							}
						})}
					</AccordionContent>
				</AccordionItem>
			</Accordion>
		</div>
	);
};

export { AnnotationBlock };
