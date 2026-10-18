import { useState } from 'react';
import { Dropdown } from 'react-bootstrap';
import { StartRange, StartRangePreset } from '../domain/listView';
import './MultiSelect.css';

const PRESETS: { preset: StartRangePreset; label: string }[] = [
	{ preset: 'all', label: 'wszystkie' },
	{ preset: 'today', label: 'Dziś' },
	{ preset: 'week', label: '+7 dni' },
	{ preset: 'twoWeeks', label: '+14 dni' }
];

const shortDate = (date: string) => date.split('-').reverse().slice(0, 2).join('.');

/** Opis zakresu w przycisku: „+14 dni”, „13.10–20.10”, „od 13.10”. */
function rangeSummary(range: StartRange): string {
	if (range.preset !== 'custom') return PRESETS.find((p) => p.preset === range.preset)?.label ?? 'wszystkie';
	if (range.from && range.to) return `${shortDate(range.from)}–${shortDate(range.to)}`;
	if (range.from) return `od ${shortDate(range.from)}`;
	if (range.to) return `do ${shortDate(range.to)}`;
	return 'własny';
}

interface StartRangeFilterProps {
	value: StartRange;
	onChange: (range: StartRange) => void;
}

/** Filtr dat startu: presety liczone od teraz i własny zakres dni. */
const StartRangeFilter = ({ value, onChange }: StartRangeFilterProps) => {
	const [open, setOpen] = useState(false);
	const active = value.preset !== 'all' && !(value.preset === 'custom' && !value.from && !value.to);
	const custom = value.preset === 'custom';
	return (
		<Dropdown show={open} onToggle={setOpen} autoClose="outside" className="multi-select">
			<Dropdown.Toggle as="button" id="filterStart" bsPrefix="multi-select-toggle" className={active ? 'has-selection' : ''}>
				<span className="multi-select-label">Start</span>
				<span className="multi-select-value">{rangeSummary(value)}</span>
				<span className="multi-select-caret" aria-hidden="true">
					{open ? '▴' : '▾'}
				</span>
			</Dropdown.Toggle>
			<Dropdown.Menu className="multi-select-menu">
				<div className="multi-select-options" role="group" aria-label="Start">
					{[...PRESETS, { preset: 'custom' as const, label: 'Własny…' }].map(({ preset, label }) => (
						<button
							key={preset}
							type="button"
							role="menuitemradio"
							aria-checked={value.preset === preset}
							className="multi-select-option"
							onClick={() => {
								onChange(preset === 'custom' ? { preset, from: value.from, to: value.to } : { preset });
								if (preset !== 'custom') setOpen(false);
							}}>
							<span className="check-box is-radio" aria-hidden="true">
								{value.preset === preset ? '●' : ''}
							</span>
							{label === 'wszystkie' ? 'Wszystkie' : label}
						</button>
					))}
				</div>
				{custom && (
					<div className="start-range-custom">
						<label>
							od
							<input
								type="date"
								className="form-control form-control-sm mono"
								value={value.from ?? ''}
								onChange={(e) => onChange({ ...value, from: e.target.value || undefined })}
							/>
						</label>
						<label>
							do
							<input
								type="date"
								className="form-control form-control-sm mono"
								value={value.to ?? ''}
								onChange={(e) => onChange({ ...value, to: e.target.value || undefined })}
							/>
						</label>
					</div>
				)}
			</Dropdown.Menu>
		</Dropdown>
	);
};

export default StartRangeFilter;
