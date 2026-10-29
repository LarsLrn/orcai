import type { LibrarySort } from "@orcai/schema";
import { SlidersHorizontalIcon } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { OptionPicker } from "@/components/ui/composed/option-picker";
import {
	Drawer,
	DrawerContent,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
} from "@/components/ui/drawer";
import {
	Field,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
	activeFilterCount,
	type FilterDefinitions,
	type FilterValues,
} from "@/lib/browse/browse-search";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

type FilterFieldsProps<D extends FilterDefinitions> = {
	className?: string;
	filters: D;
	values: FilterValues<D>;
	onChange: (key: keyof D & string, value: string | string[] | boolean) => void;
};

/** One field per filter definition: radios for a single choice, checkboxes for several or a toggle. */
const FilterFields = <D extends FilterDefinitions>({
	className,
	filters,
	values,
	onChange,
}: FilterFieldsProps<D>) => {
	const id = useId();
	return (
		<div className={cn("flex flex-col gap-6", className)}>
			{Object.entries(filters).map(([key, definition]) =>
				definition.type === "multi" &&
				definition.options.length === 0 ? null : (
					<FieldSet key={key} className="gap-0">
						<FieldLegend
							variant="label"
							className="mb-2 font-medium text-muted-foreground text-sm"
						>
							{definition.label()}
						</FieldLegend>
						{definition.type === "single" ? (
							<RadioGroup
								value={values[key]}
								onValueChange={(value) => onChange(key, value as string)}
								className="gap-2"
							>
								{definition.options.map((option) => (
									<Field key={option.value} orientation="horizontal">
										<RadioGroupItem
											value={option.value}
											id={`${id}-${key}-${option.value}`}
										/>
										<FieldLabel
											htmlFor={`${id}-${key}-${option.value}`}
											className="font-normal"
										>
											{option.label()}
										</FieldLabel>
									</Field>
								))}
							</RadioGroup>
						) : definition.type === "multi" ? (
							<div className="flex flex-col gap-2">
								{definition.options.map((option) => {
									const selected = values[key] as string[];
									return (
										<Field key={option.value} orientation="horizontal">
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
											<FieldLabel
												htmlFor={`${id}-${key}-${option.value}`}
												className="min-w-0 font-normal"
											>
												<span className="truncate">{option.label()}</span>
											</FieldLabel>
										</Field>
									);
								})}
							</div>
						) : (
							<Field orientation="horizontal">
								<Checkbox
									id={`${id}-${key}`}
									checked={values[key] === true}
									onCheckedChange={(checked) => onChange(key, checked === true)}
								/>
								<FieldLabel htmlFor={`${id}-${key}`} className="font-normal">
									{definition.optionLabel()}
								</FieldLabel>
							</Field>
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
				<div className="min-h-0 flex-1 overflow-y-auto px-6 pt-1 pb-8">
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

/** Newest or A to Z: two toggles, a compact dropdown below `sm` where they would wrap. */
const SortControl = ({
	value,
	onChange,
}: {
	value: LibrarySort;
	onChange: (sort: LibrarySort) => void;
}) => (
	<>
		<OptionPicker
			options={sortOptions()}
			value={value}
			onChange={onChange}
			size="sm"
			aria-label={m.browse_sort_label()}
			className="sm:hidden"
		/>
		{/* biome-ignore lint/a11y/useSemanticElements: a toolbar of toggles, not a fieldset of inputs */}
		<div
			role="group"
			aria-label={m.browse_sort_label()}
			className="hidden items-center gap-1 text-sm sm:flex"
		>
			<span aria-hidden="true" className="mr-1 text-muted-foreground">
				{m.browse_sort_label()}
			</span>
			{sortOptions().map((option) => (
				<Button
					key={option.value}
					size="xs"
					variant={value === option.value ? "secondary" : "ghost"}
					aria-pressed={value === option.value}
					onClick={() => onChange(option.value)}
				>
					{option.label}
				</Button>
			))}
		</div>
	</>
);

export { FilterFields, FiltersDrawer, SortControl };
