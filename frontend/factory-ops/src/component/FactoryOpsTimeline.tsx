import React, { useEffect, useState } from 'react';
import Timeline, { TimelineMarkers } from 'react-calendar-timeline';
import { TimelineHeaders, SidebarHeader, DateHeader, TodayMarker } from 'react-calendar-timeline';
import 'react-calendar-timeline/lib/Timeline.css';
import moment from 'moment';
import { Item } from '../models/Item';
import { Group } from '../models/Group';
import { ItemService } from '../services/ItemService';
import { GroupService } from '../services/GroupService';
import AddNewItemModal from './AddNewModal';
import EditItemModal from './EditItemModal';
import DeleteItemModal from './DeleteItemModal';
import { CreateItem } from '../models/CreateItemModel';
import { ItemDto } from '../models/ItemDto';

const FactoryOpsTimeline = () => {
	const [groups, setGroups] = useState<Group[]>([]);
	const [items, setItems] = useState<Item[]>([]);
	const [selectedItem, setSelectedItem] = useState<Item | undefined>();

	useEffect(() => {
		async function fetchData() {
			const items = (await ItemService.getAll()).map((item) => {
				console.log('itemDto', item);
				return mapItemDtoToItem(item);
			});
			console.log('items', items);
			setItems(items);
			const groups = await GroupService.getAllGroups();
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
		setSelectedItem(getItemById(itemId));
	};

	const onDeselectItem = () => {
		setSelectedItem(undefined);
	};

	const handleAddNewItem = async (createItem: CreateItem) => {
		const newItem = mapItemDtoToItem(await ItemService.create(createItem));
		setItems([...items, newItem]);
	};

	const handleDeleteItem = (item: Item) => {
		setItems(items.filter((i) => i.id !== item.id));
	};

	const getItemById = (itemId: number | undefined): Item | undefined => {
		return items.find((item) => item.id === itemId);
	};

	function mapItemDtoToItem(item: ItemDto): Item {
		const newItem = {
			id: item.id,
			group: item.group,
			title: item.title,
			start_time: new Date(item.startTime).valueOf(),
			end_time: new Date(item.startTime).valueOf() + item.length * 60 * 60 * 1000,
			length: item.length,
			canMove: true,
			canResize: true,
			canChangeGroup: true,
			programmer: item.programmer
		};
		return newItem;
	}

	return (
		<>
			<div>
				<div className="d-flex flex-row mb-3">
					<AddNewItemModal createNewItem={handleAddNewItem} />
					<EditItemModal item={selectedItem} UpdateItem={(item: Item) => setItems(items.map((i) => (i.id === item.id ? item : i)))} />
					<DeleteItemModal onDelete={() => handleDeleteItem(selectedItem!)} itemName={selectedItem?.title || ''} />
				</div>
				<Timeline
					groups={groups}
					items={items}
					defaultTimeStart={moment().startOf('day').toDate()}
					defaultTimeEnd={moment().startOf('day').add(1, 'day').toDate()}
					onItemSelect={onSelectItem}
					onItemDeselect={onDeselectItem}
					stackItems={true}
					canMove={true}
					canChangeGroup={true}
					minZoom={1000 * 60 * 60 * 24}
					dragSnap={1000 * 60 * 60 * 24}
					itemHeightRatio={0.75}
					lineHeight={50}
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
