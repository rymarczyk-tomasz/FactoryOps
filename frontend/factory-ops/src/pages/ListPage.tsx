import React from 'react';
import ItemList from '../component/ItemList';

const ListPage = () => {
	return(
		<div>
			<a href="/">go to timeline</a>
			<div className="card m-5 p-3">
				<ItemList  />
			</div>
		</div>
	);
};

export default ListPage;
