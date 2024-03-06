import React, { FC, useState } from 'react';
import { useForm } from 'react-hook-form';
import Modal from 'react-bootstrap/Modal';
import { Item } from '../models/Item';
import { Button, ModalHeader } from 'react-bootstrap';

interface EditItemProperties {
	item: Item | undefined;
	UpdateItem: (item: Item) => void;
}

interface EditItemForm {
	group: number;
	title: string;
	start_time: number;
	length: number;
}

const EditItemModal: FC<EditItemProperties> = (props: EditItemProperties) => {
	const [showModal, setShowModal] = useState<boolean>(false);
	const { handleSubmit, register } = useForm<EditItemForm>({
		defaultValues: {
			group: props.item?.group,
			title: props.item?.title,
			start_time: props.item?.start_time,
			length: props.item?.length
		}
	});

	const handleClose = () => setShowModal(false);

	const onSubmitAction = (data: EditItemForm) => {
		const startTime = new Date(data.start_time).getTime();
		const item: Item = {
			id: props.item?.id ?? 0,
			group: data.group,
			title: data.title,
			start_time: new Date(data.start_time.valueOf()).valueOf(),
			end_time: new Date(startTime + data.length * 60 * 60 * 1000).getTime(),
			length: data.length,
			canMove: true,
			canResize: false,
			canChangeGroup: true
		};
		props.UpdateItem(item);
		handleClose();
	};

	function dateString() {
		const date = new Date(props.item?.start_time ?? 0);
		return date.toISOString().substring(0, 16);
	}

	return (
		<>
			<Button
				variant="primary"
				size={'sm'}
				onClick={() => {
					setShowModal(true);
				}}>
				Edit
			</Button>
			<Modal show={showModal} onHide={handleClose}>
				<ModalHeader>
					<div>Edit Item</div>
				</ModalHeader>
				<Modal.Body>
					{!props.item && <div className="container d-flex">Item not found</div>}
					{props.item && (
						<div className="container d-flex">
							<div className="row">
								<form className="col-12" id="addNewItem" onSubmit={handleSubmit(onSubmitAction)}>
									<label className="form-label" htmlFor="group">
										Group
									</label>
									<input
										id="group"
										{...register('group', {
											required: {
												value: true,
												message: 'Group is required'
											}
										})}
										className="form-control"
										defaultValue={props.item.group}
									/>
									<label className="form-label" htmlFor="title">
										Item title
									</label>
									<input
										id="title"
										{...register('title', {
											required: {
												value: true,
												message: 'Title is required'
											}
										})}
										className="form-control"
										defaultValue={props.item.title}
									/>
									<label className="form-label" htmlFor="start_time">
										Start time
									</label>
									<input
										type="datetime-local"
										id="start_time"
										{...register('start_time', {
											required: {
												value: true,
												message: 'Start time is required'
											}
										})}
										className="form-control"
										defaultValue={dateString()}
									/>
									<label className="form-label" htmlFor="length">
										Length
									</label>
									<input
										type="number"
										id="length"
										{...register('length', {
											required: {
												value: true,
												message: 'Length is required'
											}
										})}
										className="form-control date"
										defaultValue={props.item.length}
									/>
								</form>
							</div>
						</div>
					)}
				</Modal.Body>

				<Modal.Footer>
					<Button variant="light" onClick={handleClose}>
						Close
					</Button>
					<Button type="submit" form="addNewItem" variant="primary" onClick={() => onSubmitAction}>
						Submit
					</Button>
				</Modal.Footer>
			</Modal>
		</>
	);
};

export default EditItemModal;
