import React, { useEffect, useState } from 'react';
import Timeline, { TimelineMarkers } from 'react-calendar-timeline';
import { TimelineHeaders, SidebarHeader, DateHeader, TodayMarker } from 'react-calendar-timeline';
import 'react-calendar-timeline/lib/Timeline.css';
import moment from 'moment';
import { Item } from '../models/Item';
import { Group } from '../models/Group';
import { GroupService, ItemService } from '../services/Services';
import AddNewItemModal from './AddNewModal';
import EditItemModal from './EditItemModal';
import DeleteItemModal from './DeleteItemModa';

const FactoryOpsTimeline = () => {
	const [groups, setGroups] = useState<Group[]>([]);
	const [items, setItems] = useState<Item[]>([]);
	const [selectedItemId, setSelectedItem] = useState<number | undefined>();

	useEffect(() => {
		async function fetchData() {
			const items = await ItemService.getAllItems();
			setItems(items);
			const groups = await GroupService.getAllGroupsMock();
			setGroups(groups);
		}

		fetchData();
	}, []);

	const handleItemMove = (itemId: number, dragTime: number, newGroupOrder: number) => {
		const group = groups[newGroupOrder];
		setItems(
			items.map((item) => {
				if (item.id === itemId) {
					const duration = item.end_time - item.start_time;
					item.start_time = dragTime;
					item.end_time = dragTime + duration;
					item.group = group.id;
				}
				return item;
			})
		);
	};

	const onSelectItem = (itemId: number) => {
		setSelectedItem(itemId);
	};

	const onDeselectItem = () => {
		setSelectedItem(undefined);
	};

	const handleDeleteItem = (itemId: number) => {
		setItems(items.filter((item) => item.id !== itemId));
	};

	const getItemById = (itemId: number | undefined): Item | undefined => {
		return items.find((item) => item.id === itemId);
	};

	return (
		<>
			<div>
				<div className="d-flex flex-row mb-3">
					<AddNewItemModal nextId={items.length + 1} createNewItem={(item: Item) => setItems([...items, item])} />
					<EditItemModal item={getItemById(selectedItemId)} UpdateItem={(item: Item) => setItems(items.map((i) => (i.id === item.id ? item : i)))} />
					<DeleteItemModal onDelete={() => handleDeleteItem(selectedItemId!)} />
				</div>
				<Timeline
					groups={groups}
					items={items}
					defaultTimeStart={moment().startOf('day').toDate()}
					defaultTimeEnd={moment().startOf('day').add(1, 'day').toDate()}
					onItemSelect={onSelectItem}
					onItemDeselect={onDeselectItem}
					stackItems
					canMove
					canChangeGroup
					minZoom={1000 * 60 * 60 * 24}
					dragSnap={1000 * 60}
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
