import { useState } from 'react';
import { Dropdown } from 'react-bootstrap';
import './MultiSelect.css';

export interface MultiSelectOption {
	value: string;
	label: string;
	/** Nagłówek grupy - pokazywany nad pierwszą opcją grupy. */
	group?: string;
	/** Wcięcie (np. maszyna pod swoją linią). */
	indent?: boolean;
	/** Nazwa maszyny / numer - pismem mono. */
	mono?: boolean;
}

interface MultiSelectProps {
	/** Np. „Maszyna” - szara etykieta w przycisku. */
	label: string;
	/** Wartość, gdy nic nie wybrano, np. „wszystkie”. */
	allLabel: string;
	options: MultiSelectOption[];
	selected: string[];
	onChange: (selected: string[]) => void;
	id: string;
}

/** Filtr z kilkoma wartościami naraz: przycisk „Maszyna · 3 wybrane”, w menu wyszukiwanie i pola wyboru. Pusty wybór = bez filtra. */
const MultiSelect = ({ label, allLabel, options, selected, onChange, id }: MultiSelectProps) => {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState('');
	const chosen = options.filter((o) => selected.includes(o.value));
	const summary = chosen.length === 0 ? allLabel : chosen.length === 1 ? chosen[0].label : `${chosen.length} wybrane`;
	const toggle = (value: string) => onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
	const q = query.trim().toLowerCase();
	const visible = q ? options.filter((o) => o.label.toLowerCase().includes(q) || o.group?.toLowerCase().includes(q)) : options;

	return (
		<Dropdown
			show={open}
			onToggle={(next) => {
				setOpen(next);
				if (next) setQuery('');
			}}
			autoClose="outside"
			className="multi-select">
			<Dropdown.Toggle
				as="button"
				id={id}
				bsPrefix="multi-select-toggle"
				className={chosen.length ? 'has-selection' : ''}
				title={chosen.length > 1 ? chosen.map((o) => o.label).join(', ') : undefined}>
				<span className="multi-select-label">{label}</span>
				<span className="multi-select-value">{summary}</span>
				<span className="multi-select-caret" aria-hidden="true">
					{open ? '▴' : '▾'}
				</span>
			</Dropdown.Toggle>
			<Dropdown.Menu className="multi-select-menu">
				<div className="multi-select-search">
					<input
						type="search"
						className="form-control form-control-sm"
						placeholder="Szukaj…"
						aria-label={`Szukaj: ${label}`}
						value={query}
						autoFocus
						onChange={(e) => setQuery(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Escape') setOpen(false);
						}}
					/>
				</div>
				<div className="multi-select-options" role="group" aria-label={label}>
					{visible.map((option, index) => (
						<div key={option.value}>
							{option.group && option.group !== visible[index - 1]?.group && <div className="multi-select-group">{option.group}</div>}
							<button
								type="button"
								role="menuitemcheckbox"
								aria-checked={selected.includes(option.value)}
								className={`multi-select-option ${option.indent ? 'indent' : ''} ${option.mono ? 'mono' : ''}`}
								onClick={() => toggle(option.value)}>
								<span className="check-box" aria-hidden="true">
									{selected.includes(option.value) ? '✓' : ''}
								</span>
								{option.label}
							</button>
						</div>
					))}
					{visible.length === 0 && <div className="multi-select-empty">Brak wyników</div>}
				</div>
				<div className="multi-select-footer">
					<button type="button" className="multi-select-clear" disabled={chosen.length === 0} onClick={() => onChange([])}>
						Wyczyść wybór
					</button>
					<button type="button" className="multi-select-done" onClick={() => setOpen(false)}>
						Gotowe
					</button>
				</div>
			</Dropdown.Menu>
		</Dropdown>
	);
};

export default MultiSelect;
