import React, { FC, useState } from 'react';
import { useForm } from 'react-hook-form';
import Modal from 'react-bootstrap/Modal';
import { Item } from '../models/Item';
import { Button, ModalHeader, } from 'react-bootstrap';


interface EditItemProperties {
	item: Item | undefined;
	UpdateItem: (item: Item) => void;
}

interface EditItemForm {
	group: number;
	title: string;
	start_time: Date;
	end_time: Date;
	canMove: boolean;
	canResize: boolean;
	canChangeGroup: boolean;
}

const EditItemModal: FC<EditItemProperties> = (props: EditItemProperties) => {
	const [showModal, setShowModal] = useState<boolean>(false);
	const {
		handleSubmit,
		register,
		// formState: { errors }
	} = useForm<EditItemForm>({
		defaultValues: {
			group: props.item?.group,
			title: props.item?.title,
			start_time: new Date(props.item?.start_time ?? Date.now()),
			end_time: new Date(props.item?.end_time ?? Date.now()),
			canMove: props.item?.canMove,
			canResize: props.item?.canResize,
			canChangeGroup: props.item?.canChangeGroup
		}
	});

	const handleClose = () => setShowModal(false);

	const onSubmitAction = (data: EditItemForm) => {
		const item: Item = {
			id: props.item?.id ?? 0,
			group: data.group,
			title: data.title,
			start_time: new Date(data.start_time.valueOf()).valueOf(),
			end_time: new Date(data.end_time.valueOf()).valueOf(),
			length: data.end_time.valueOf() - data.start_time.valueOf(),
			canMove: data.canMove,
			canResize: data.canResize,
			canChangeGroup: data.canChangeGroup
		};
		props.UpdateItem(item);
		handleClose();
	};

	return (
		<>
			<Button variant="primary" size={'sm'} onClick={() => setShowModal(true)}>
				Edit
			</Button>
			<Modal show={showModal} onHide={handleClose}>
				<ModalHeader>
					<div>Edit Item</div>
				</ModalHeader>
				<Modal.Body>
					{!props.item && (
						<div className="container d-flex">Item not found</div>
					)}
					{props.item && (
						<div className="container d-flex">
							<div className="row">
								<form className="col-12" id="addNewItem" onSubmit={handleSubmit(onSubmitAction)}>
									<label className="form-label" htmlFor="group">Group</label>
									<input id="group" {...register('group', {
										required: {
											value: true,
											message: 'Group is required',
										}
									})} className="form-control" defaultValue={props.item.group}/>
									<label className="form-label" htmlFor="title">Item title</label>
									<input id="title" {...register('title', {
										required: {
											value: true,
											message: 'Title is required',
										}
									})} className="form-control" defaultValue={props.item.title}/>
									<label className="form-label" htmlFor="start_time">Start time</label>
									<input type="datetime-local" id="start_time" {...register('start_time', {
										required: {
											value: true,
											message: 'Start time is required',
										}
									})} className="form-control" defaultValue={props.item.start_time}/>
									<label className="form-label" htmlFor="end_time">End time</label>
									<input type="datetime-local" id="end_time" {...register('end_time', {
										required: {
											value: true,
											message: 'End time is required',
										}
									})} className="form-control date" defaultValue={props.item.end_time}/>
									<label className="form-label" htmlFor="canMove">Can move</label>
									<input type="checkbox" id="canMove" {...register('canMove')}
										className="form-check-input" defaultChecked={props.item.canMove}/>
									<label className="form-label" htmlFor="canChangeGroup">Can change group</label>
									<input type="checkbox" id="canChangeGroup" {...register('canChangeGroup')}
										className="form-check-input" defaultChecked={props.item.canChangeGroup}/>
								</form>
							</div>
						</div>
					)}
				</Modal.Body>

				<Modal.Footer>
					<Button variant="light" onClick={handleClose}>
					Close
					</Button>
					<Button type="submit" form="addNewItem" variant="primary" onClick={() => onSubmitAction} >
					Submit
					</Button>
				</Modal.Footer>
			</Modal>
		</>
	);
};

export default EditItemModal;
