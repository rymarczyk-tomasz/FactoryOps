import React from 'react';

export default function ContentPicker({ onViewChange }) {
	const handleButtonClick = (view) => {
		onViewChange(view);
	};

	return (
		<div className="btn-group-vertical mt-5">
			<button className="btn btn-outline-primary btn-lg" onClick={() => handleButtonClick('PLAN')}>
				PLAN
			</button>
			<button className="btn btn-outline-primary btn-lg" onClick={() => handleButtonClick('ITEM')}>
				ItemList - prog
			</button>
			<button className="btn btn-outline-primary btn-lg" onClick={() => handleButtonClick('PLAN')}>
				3-axis
			</button>
			<button className="btn btn-outline-primary btn-lg" onClick={() => handleButtonClick('ITEM')}>
				5-axis
			</button>
			<button className="btn btn-outline-primary btn-lg" onClick={() => handleButtonClick('PLAN')}>
				HTSM500
			</button>
			<button className="btn btn-outline-primary btn-lg" onClick={() => handleButtonClick('ITEM')}>
				HTSM300
			</button>
		</div>
	);
}
