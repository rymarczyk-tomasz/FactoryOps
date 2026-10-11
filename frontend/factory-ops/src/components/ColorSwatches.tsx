import { PROJECT_COLORS } from './projectColor';
import { radioKeyDown } from './radioKeys';

interface ColorSwatchesProps {
	value: string;
	onChange: (color: string) => void;
	label: string;
	size?: 'sm';
}

/** Wybór koloru projektu z palety - grupa radio (strzałki zmieniają wybór). */
const ColorSwatches = ({ value, onChange, label, size }: ColorSwatchesProps) => (
	<div className={`color-swatches ${size === 'sm' ? 'is-small' : ''}`} role="radiogroup" aria-label={label} onKeyDown={radioKeyDown(PROJECT_COLORS, value, onChange)}>
		{PROJECT_COLORS.map((color, index) => {
			const checked = color === value;
			return (
				<button
					key={color}
					type="button"
					role="radio"
					aria-checked={checked}
					aria-label={`Kolor ${index + 1}`}
					tabIndex={checked || (!PROJECT_COLORS.includes(value) && index === 0) ? 0 : -1}
					className={`color-swatch ${checked ? 'is-checked' : ''}`}
					style={{ background: color }}
					onClick={() => onChange(color)}
				/>
			);
		})}
	</div>
);

export default ColorSwatches;
