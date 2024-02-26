import React from 'react';
import { useEffect, useState } from 'react';
import Timeline, { TimelineMarkers } from 'react-calendar-timeline';
import { TimelineHeaders, SidebarHeader, DateHeader, TodayMarker } from 'react-calendar-timeline';
import 'react-calendar-timeline/lib/Timeline.css';
import moment from 'moment';
import { Item } from '../models/Item';
import { Group } from '../models/Group';
import { GroupService, ItemService } from '../services/Services';
import AddNewItemModal from './AddNewModal';
import EditItemModal from './EditItemModal';

const FactoryOpsTimeline = () => {
	const [groups, setGroups] = useState<Group[]>([]);
	const [items, setItems] = useState<Item[]>([]);
	const [selectedItemId, setSelectedItem] = useState<Item | undefined>();

	useEffect(() => {
		async function fetchData() {
			const items = await ItemService.getAllItems();
			setItems(items);
			const groups = await GroupService.getAllGroupsMock();
			setGroups(groups);
		}

		fetchData();
	}, []);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

	const onSelect = (itemId: number) => {
		const selectedItem = getItemByItemId(itemId);
		setSelectedItem(selectedItem);
	};

	const onDeselect = () => {
		setSelectedItem(undefined);
	};

	const addNewItem = (item: Item) => {
		setItems([...items, item]);
	};

	const editItem = (item: Item) => {
		setItems(
			items.map((i: Item) => {
				if (i.id === item.id) {
					i = item;
				}
				return i;
			})
		);
	};

	const getItemByItemId = (itemId: number | undefined): Item | undefined => {
		return items.find((item: Item) => item.id === itemId);
	};

	return (
		<>
			<div>
				<div className="d-flex flex-row mb-3">
					<button>{selectedItemId?.id}</button>
					<AddNewItemModal nextId={items.length + 1} createNewItem={addNewItem} />
					<EditItemModal item={selectedItemId} UpdateItem={editItem} />
				</div>
				<Timeline
					groups={groups}
					items={items}
					defaultTimeStart={moment().startOf('day').toDate()}
					defaultTimeEnd={moment().startOf('day').add(1, 'day').toDate()}
					// itemTouchSendsClick={false}
					onItemSelect={onSelect}
					onItemDeselect={onDeselect}
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
