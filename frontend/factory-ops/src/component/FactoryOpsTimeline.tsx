import React, { useEffect, useState } from 'react';
import Timeline, { TimelineMarkers, TimelineHeaders, SidebarHeader, DateHeader, TodayMarker } from 'react-calendar-timeline';
import 'react-calendar-timeline/style.css';
// import moment from 'moment';
import { Item } from '../models/Item';
import { CreateGroup, Group } from '../models/Group';
import { ItemService } from '../services/ItemService';
import { GroupService } from '../services/GroupService';
import AddNewItemModal from './Items/AddNewItemModal';
import EditItemModal from './Items/EditItemModal';
import DeleteItemModal from './Items/DeleteItemModal';
import { CreateItem } from '../models/CreateItemModel';
import { ItemDto } from '../models/ItemDto';
import AddNewGroupModal from './Groups/AddNewGroupModal';
import EditGroupModal from './Groups/EditGroupModal';
import DeleteGroupModal from './Groups/DeleteGroupModal';

const FactoryOpsTimeline = () => {
	const [groups, setGroups] = useState<Group[]>([]);
	const [items, setItems] = useState<Item[]>([]);
	const [selectedItem, setSelectedItem] = useState<Item | undefined>();
	const [selectedGroupId, setSelectedGroupId] = useState<number | undefined>();

	useEffect(() => {
		async function fetchData() {
			const items = (await ItemService.getAll()).map((item) => {
				return mapItemDtoToItem(item);
			});
			console.log('items', items);
			setItems(items);
			const groups = await GroupService.getAllGroups();
			console.log(groups);
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

	const handleDeleteGroup = (group: Group) => {
		setGroups(groups.filter((g) => g.id !== group.id));
		if (selectedGroupId === group.id) {
			setSelectedGroupId(undefined);
		}
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

	const handleCreateNewGroup = async (group: CreateGroup) => {
		const newGroup = await GroupService.create(group);
		setGroups([...groups, newGroup]);
	};

	const handleUpdateGroup = async (group: Group) => {
		try {
			const updated = await GroupService.update(group);
			setGroups(groups.map((g) => (g.id === updated.id ? updated : g)));
		} catch (err) {
			console.error('Failed to update group', err);
		}
	};

	return (
		<>
			<div>
				<a href="/list">go to list</a>
			</div>
			<div>
				<div className="d-flex flex-row justify-content-between align-items-center mb-3">
					<div>
						<label>Item Actions</label>
						<div className="d-flex flex-row mb-3">
							<AddNewItemModal createNewItem={handleAddNewItem} />
							<EditItemModal item={selectedItem} UpdateItem={(item: Item) => setItems(items.map((i) => (i.id === item.id ? item : i)))} />
							<DeleteItemModal onDelete={() => handleDeleteItem(selectedItem!)} itemName={selectedItem?.title || ''} />
						</div>
					</div>
					<div>
						<label>Group Actions</label>
						<div className="d-flex flex-row mb-3 align-items-center">
							<AddNewGroupModal createNewGroup={handleCreateNewGroup} />
							<EditGroupModal
								group={groups.find((g) => g.id === selectedGroupId)}
								UpdateGroup={(g: Group) => handleUpdateGroup(g)}
							/>
							<select
								className="form-select ms-2"
								style={{ width: '200px' }}
								value={selectedGroupId ?? ''}
								onChange={(e) => setSelectedGroupId(e.target.value ? Number(e.target.value) : undefined)}>
								<option value="">Select group...</option>
								{groups.map((g) => (
									<option key={g.id} value={g.id}>
										{String(g.title)}
									</option>
								))}
							</select>
							{selectedGroupId ? (
								<DeleteGroupModal
									onDelete={() => handleDeleteGroup(groups.find((g) => g.id === selectedGroupId) as Group)}
									groupName={String(groups.find((g) => g.id === selectedGroupId)?.title || '')}
								/>
							) : (
								<div className="ms-2">
									<button className="btn btn-danger btn-sm" disabled>
										Delete
									</button>
								</div>
							)}
						</div>
					</div>
				</div>
				<Timeline
					groups={groups}
					items={items}
					defaultTimeStart={Date.now()}
					defaultTimeEnd={Date.now() + 1000 * 60 * 60 * 24}
					onItemSelect={onSelectItem}
					onItemDeselect={onDeselectItem}
					stackItems={true}
					canMove={true}
					canChangeGroup={true}
					minZoom={1000 * 60 * 60 * 24}
					maxZoom={1000 * 60 * 60 * 24 * 30 * 2}
					dragSnap={1000 * 60 * 60 * 24}
					itemHeightRatio={0.9}
					// lineHeight={50}
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
						<TodayMarker />
					</TimelineMarkers>
				</Timeline>
			</div>
		</>
	);
};

export default FactoryOpsTimeline;
