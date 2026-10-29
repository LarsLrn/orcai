import type { LibrarySort } from "@orcai/schema";
import {
	ArrowDownUpIcon,
	ChevronDownIcon,
	SlidersHorizontalIcon,
} from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Drawer,
	DrawerContent,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
} from "@/components/ui/drawer";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
	activeFilterCount,
	type FilterDefinitions,
	type FilterValues,
} from "@/lib/browse/browse-search";
import { m } from "@/paraglide/messages";

type FilterFieldsProps<D extends FilterDefinitions> = {
	filters: D;
	values: FilterValues<D>;
	onChange: (key: keyof D & string, value: string | string[] | boolean) => void;
};

/** A full-width row: the label is the whole hit area and wraps its control. */
const FilterRow = ({
	id,
	control,
	children,
}: {
	id: string;
	control: React.ReactNode;
	children: React.ReactNode;
}) => (
	<FieldLabel
		htmlFor={id}
		className="-mx-2 w-auto items-center gap-3 rounded-lg px-2 py-1.5 font-normal hover:bg-muted has-data-checked:bg-muted has-data-checked:font-medium"
	>
		{control}
		<span className="min-w-0 break-words">{children}</span>
	</FieldLabel>
);

/** One card per filter definition: radios for a single choice, checkboxes for several or a toggle, each option a full-width row. */
const FilterFields = <D extends FilterDefinitions>({
	filters,
	values,
	onChange,
}: FilterFieldsProps<D>) => {
	const id = useId();
	return (
		<div className="flex flex-col gap-3">
			{Object.entries(filters).map(([key, definition]) =>
				definition.type === "multi" &&
				definition.options.length === 0 ? null : (
					<FieldSet
						key={key}
						className="block gap-0 rounded-2xl border bg-card px-3 pb-2 shadow-xs [&>*:not(legend)]:clear-both"
					>
						<FieldLegend
							variant="label"
							className="float-left -mx-3 mb-2 w-[calc(100%+1.5rem)] border-b px-3 py-2.5 font-medium text-foreground text-sm"
						>
							{definition.label()}
						</FieldLegend>
						{definition.type === "single" ? (
							<RadioGroup
								value={values[key]}
								onValueChange={(value) => onChange(key, value as string)}
								className="gap-0.5"
							>
								{definition.options.map((option) => (
									<FilterRow
										key={option.value}
										id={`${id}-${key}-${option.value}`}
										control={
											<RadioGroupItem
												value={option.value}
												id={`${id}-${key}-${option.value}`}
											/>
										}
									>
										{option.label()}
									</FilterRow>
								))}
							</RadioGroup>
						) : definition.type === "multi" ? (
							<div className="flex flex-col gap-0.5">
								{definition.options.map((option) => {
									const selected = values[key] as string[];
									return (
										<FilterRow
											key={option.value}
											id={`${id}-${key}-${option.value}`}
											control={
												<Checkbox
													id={`${id}-${key}-${option.value}`}
													checked={selected.includes(option.value)}
													onCheckedChange={(checked) =>
														onChange(
															key,
															checked
																? [
																		...selected,
																		option.value,
																	]
																: selected.filter(
																		(value) => value !== option.value,
																	),
														)
													}
												/>
											}
										>
											{option.label()}
										</FilterRow>
									);
								})}
							</div>
						) : (
							<FilterRow
								id={`${id}-${key}`}
								control={
									<Checkbox
										id={`${id}-${key}`}
										checked={values[key] === true}
										onCheckedChange={(checked) =>
											onChange(key, checked === true)
										}
									/>
								}
							>
								{definition.optionLabel()}
							</FilterRow>
						)}
					</FieldSet>
				),
			)}
		</div>
	);
};

/** "Filters (n)" below `lg`, opening the same fields in a drawer. */
const FiltersDrawer = <D extends FilterDefinitions>(
	props: FilterFieldsProps<D>,
) => {
	const active = activeFilterCount(props.filters, props.values);
	return (
		<Drawer>
			<DrawerTrigger
				render={
					<Button variant="outline" size="sm" className="lg:hidden">
						<SlidersHorizontalIcon
							data-icon="inline-start"
							aria-hidden="true"
						/>
						{active > 0
							? m.browse_filters_count_action({
									count: active,
								})
							: m.browse_filters_action()}
					</Button>
				}
			/>
			<DrawerContent>
				<DrawerHeader>
					<DrawerTitle>{m.browse_filters_title()}</DrawerTitle>
				</DrawerHeader>
				<div className="overflow-y-auto px-6 pt-1 pb-8">
					<FilterFields {...props} />
				</div>
			</DrawerContent>
		</Drawer>
	);
};

const sortOptions = () =>
	[
		{
			value: "newest",
			label: m.browse_sort_newest(),
		},
		{
			value: "name",
			label: m.browse_sort_name(),
		},
	] as const;

/** The current sort in a small menu beside the results heading. */
const SortControl = ({
	value,
	onChange,
}: {
	value: LibrarySort;
	onChange: (sort: LibrarySort) => void;
}) => {
	const current = sortOptions().find((option) => option.value === value);
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						variant="ghost"
						size="sm"
						aria-label={`${m.browse_sort_label()}: ${current?.label ?? ""}`}
					>
						<ArrowDownUpIcon data-icon="inline-start" aria-hidden="true" />
						<span className="text-muted-foreground">
							{m.browse_sort_label()}:
						</span>
						{current?.label}
						<ChevronDownIcon
							aria-hidden="true"
							className="text-muted-foreground"
						/>
					</Button>
				}
			/>
			<DropdownMenuContent align="end" className="w-auto min-w-36">
				<DropdownMenuRadioGroup
					value={value}
					onValueChange={(next) => onChange(next as LibrarySort)}
				>
					{sortOptions().map((option) => (
						<DropdownMenuRadioItem
							key={option.value}
							value={option.value}
							closeOnClick
						>
							{option.label}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

export { FilterFields, FiltersDrawer, SortControl };
