import { useEffect, useState } from 'react';
import Timeline, { TimelineMarkers } from 'react-calendar-timeline';
import { TimelineHeaders, SidebarHeader, DateHeader, TodayMarker } from 'react-calendar-timeline';
import 'react-calendar-timeline/lib/Timeline.css';
import moment from 'moment';

import { Item } from '../models/Item';
import { Group } from '../models/Group';
import { GroupService, ItemService } from '../services/Services';
import AddNewItemModal from './AddNewModal';
import React from 'react';

const FactoryOpsTimeline = () => {
	const [groups, setGroups] = useState<Group[]>([]);
	const [items, setItems] = useState<Item[]>([]);

	useEffect(() => {
		async function fetchData() {
			const items = await ItemService.getAllItems();
			setItems(items);
			const groups = await GroupService.getAllGroupsMock();
			setGroups(groups);
		}

		fetchData();
	}, []);

	const handleItemMove = (itemId: number, dragTime: number, newGroupOrder: any) => {
		const group = groups[newGroupOrder];
		setItems(
			items.map((item: Item) => {
				if (item.id === itemId) {
					const dur = item.end_time - item.start_time;
					item.start_time = dragTime;
					item.end_time = dragTime + dur;
					item.group = group.id;
				}
				return item;
			})
		);
	};

	// const addGroup = () => {
	// 	setGroups([
	// 		...groups,
	// 		{
	// 			id: groups.length,
	// 			title: 'group ' + groups.length,
	// 			rightTitle: 'right_group_' + groups.length,
	// 			stackItems: true
	// 		}
	// 	]);
	// };

	const addNewItem = (item: Item) => {
		console.log(item);
		console.log('item', item.start_time);
		console.log('date', Date.now());
		// setItems([...items, {
		// 	id: items.length,
		// 	group: 0,
		// 	title: item.title,
		// 	start_time: item.start_time,
		// 	end_time: item.end_time,
		// 	canMove: item.canMove,
		// 	canResize: item.canResize,
		// 	canChangeGroup: item.canChangeGroup
		// }]);
		setItems([...items, item]);
	};

	return (
		<>
			<div>
				{/* <button onClick={addGroup}>Add group</button> */}
				{/* <button onClick={testRequest}>Test request</button> */}
				<AddNewItemModal nextId={items.length} createNewItem={addNewItem} />
				<Timeline
					groups={groups}
					items={items}
					defaultTimeStart={moment().startOf('day').toDate()}
					defaultTimeEnd={moment().startOf('day').add(1, 'day').toDate()}
					// itemTouchSendsClick={false}
					stackItems={true}
					canMove={true}
					canChangeGroup={true}
					minZoom={1000 * 60 * 60 * 24}
					dragSnap={1000 * 60 * 60 * 8}
					onItemMove={handleItemMove}>
					<TimelineHeaders className="sticky">
						<SidebarHeader>
							{({ getRootProps }) => {
								return <div {...getRootProps()}>Hello</div>;
							}}
						</SidebarHeader>
						<DateHeader unit="primaryHeader" />
						<DateHeader />
					</TimelineHeaders>
					<TimelineMarkers>
						<TodayMarker date={moment.now()} />
					</TimelineMarkers>
				</Timeline>
			</div>
		</>
	);
};

export default FactoryOpsTimeline;
