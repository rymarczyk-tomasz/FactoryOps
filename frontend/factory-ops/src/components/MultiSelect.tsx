import { Dropdown, Form } from 'react-bootstrap';

export interface MultiSelectOption {
	value: string;
	label: string;
	/** Nagłówek grupy - pokazywany nad pierwszą opcją grupy. */
	group?: string;
	/** Wcięcie (np. maszyna pod swoją linią). */
	indent?: boolean;
}

interface MultiSelectProps {
	/** Np. „Status” - nazwa filtra w przycisku. */
	label: string;
	/** Tekst, gdy nic nie wybrano, np. „Wszystkie statusy”. */
	allLabel: string;
	options: MultiSelectOption[];
	selected: string[];
	onChange: (selected: string[]) => void;
	id: string;
}

/** Lista rozwijana z polami wyboru - filtr z kilkoma wartościami naraz. Pusty wybór = bez filtra. */
const MultiSelect = ({ label, allLabel, options, selected, onChange, id }: MultiSelectProps) => {
	const chosen = options.filter((o) => selected.includes(o.value));
	const summary = chosen.length === 0 ? allLabel : chosen.length <= 2 ? chosen.map((o) => o.label).join(', ') : `${label}: ${chosen.length} wybrane`;
	const toggle = (value: string) => onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);

	return (
		<Dropdown autoClose="outside" className="multi-select">
			<Dropdown.Toggle
				variant="outline-secondary"
				id={id}
				className={`w-100 text-start text-truncate ${chosen.length ? 'has-selection' : ''}`}
				title={chosen.map((o) => o.label).join(', ')}>
				{summary}
			</Dropdown.Toggle>
			<Dropdown.Menu className="multi-select-menu">
				{chosen.length > 0 && (
					<>
						<Dropdown.Item as="button" type="button" onClick={() => onChange([])}>
							Wyczyść wybór
						</Dropdown.Item>
						<Dropdown.Divider />
					</>
				)}
				{options.map((option, index) => (
					<div key={option.value}>
						{option.group && option.group !== options[index - 1]?.group && <Dropdown.Header>{option.group}</Dropdown.Header>}
						<Form.Check
							id={`${id}-${option.value}`}
							className={`multi-select-option ${option.indent ? 'indent' : ''}`}
							label={option.label}
							checked={selected.includes(option.value)}
							onChange={() => toggle(option.value)}
						/>
					</div>
				))}
			</Dropdown.Menu>
		</Dropdown>
	);
};

export default MultiSelect;
