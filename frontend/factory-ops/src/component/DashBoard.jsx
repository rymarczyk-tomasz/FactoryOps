import React from 'react';

export default function DashBoard({ onViewChange }) {
	const handleButtonClick = (view) => {
		onViewChange(view);
	};

	return (
		<div>
			<p>DASHBOARD</p>
			<button className="btn btn-primary btn-lg btn-block m-3" onClick={() => handleButtonClick('PLAN')}>
				PLAN
			</button>
			<button className="btn btn-primary btn-lg btn-block m-3" onClick={() => handleButtonClick('ITEM')}>
				ItemList
			</button>
		</div>
	);
}
