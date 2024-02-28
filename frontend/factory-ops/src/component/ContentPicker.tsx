import React, { FC } from 'react';

interface ContentPickerProps {
	onViewChange: (view: string) => void;
}

const ContentPicker: FC<ContentPickerProps> = ({ onViewChange }) => {
	const handleButtonClick = (view: string) => {
		onViewChange(view);
	};

	return (
		<div className="btn-group-vertical mt-5">
			<button className="btn btn-outline-primary btn-lg" onClick={() => handleButtonClick('PLAN')}>
				Plan produkcji
			</button>
			<button className="btn btn-outline-primary btn-lg" onClick={() => handleButtonClick('ITEM')}>
				Lista projektów
			</button>
		</div>
	);
};

export default ContentPicker;
