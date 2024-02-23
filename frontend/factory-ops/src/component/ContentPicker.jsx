import React from 'react';

export default function ContentPicker({ onViewChange }) {
	const handleButtonClick = (view) => {
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
}
