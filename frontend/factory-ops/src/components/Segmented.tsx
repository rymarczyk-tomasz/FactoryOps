import { ReactNode } from 'react';
import { radioKeyDown } from './radioKeys';

export interface SegmentedOption<T> {
	value: T;
	label: ReactNode;
	title?: string;
}

interface SegmentedProps<T> {
	options: SegmentedOption<T>[];
	value: T;
	onChange: (value: T) => void;
	label: string;
	/** Na całą szerokość, opcje po równo. */
	block?: boolean;
	className?: string;
}

/** Segmented control jako grupa radio: Tab wchodzi na wybraną opcję, strzałki zmieniają wybór. */
function Segmented<T>({ options, value, onChange, label, block, className = '' }: SegmentedProps<T>) {
	const values = options.map((o) => o.value);
	return (
		<div
			className={`segmented ${block ? 'block' : ''} ${className}`}
			role="radiogroup"
			aria-label={label}
			onKeyDown={radioKeyDown(values, value, onChange)}>
			{options.map((option, index) => {
				const checked = option.value === value;
				return (
					<button
						key={index}
						type="button"
						role="radio"
						aria-checked={checked}
						tabIndex={checked || (!values.includes(value) && index === 0) ? 0 : -1}
						title={option.title}
						className={`segmented-item ${checked ? 'active' : ''}`}
						onClick={() => onChange(option.value)}>
						{option.label}
					</button>
				);
			})}
		</div>
	);
}

export default Segmented;
