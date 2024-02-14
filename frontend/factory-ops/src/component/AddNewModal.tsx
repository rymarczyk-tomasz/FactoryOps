import React, { FC, useState } from 'react';
import { useForm } from 'react-hook-form';
import Modal from 'react-bootstrap/Modal';
import { Item } from '../models/Item';
import { Button, ModalHeader } from 'react-bootstrap';

interface AddNewItemProperties {
	nextId: number;
	createNewItem: (item: Item) => void;
}

interface AddNewItemForm {
	group: number;
	title: string;
	start_time: Date;
	end_time: Date;
	canMove: boolean;
	canResize: boolean;
	canChangeGroup: boolean;
}

const AddNewItemModal: FC<AddNewItemProperties> = (props: AddNewItemProperties) => {
	const [showModal, setShowModal] = useState<boolean>(false);
	const {
		handleSubmit,
		register
		// formState: { errors }
	} = useForm<AddNewItemForm>({
		defaultValues: {
			group: 0,
			title: 'put item title',
			start_time: new Date(),
			end_time: new Date(),
			canMove: true,
			canResize: true,
			canChangeGroup: true
		}
	});

	const handleClose = () => setShowModal(false);

	const onSubmitAction = (data: AddNewItemForm) => {
		const item: Item = {
			id: props.nextId,
			group: data.group,
			title: data.title,
			start_time: new Date(data.start_time.valueOf()).valueOf(),
			end_time: new Date(data.end_time.valueOf()).valueOf(),
			canMove: data.canMove,
			canResize: data.canResize,
			canChangeGroup: data.canChangeGroup
		};
		props.createNewItem(item);
		handleClose();
	};

	return (
		<>
			<Button variant="primary" size={'sm'} onClick={() => setShowModal(true)}>
				Add
			</Button>
			<Modal show={showModal} onHide={handleClose}>
				<ModalHeader>
					<div>Add new Item</div>
				</ModalHeader>
				<Modal.Body>
					<div className="container d-flex">
						<div className="row">
							<form className="col-6" id="addNewItem" onSubmit={handleSubmit(onSubmitAction)}>
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
								/>
								<label className="form-label" htmlFor="end_time">
									End time
								</label>
								<input
									type="datetime-local"
									id="end_time"
									{...register('end_time', {
										required: {
											value: true,
											message: 'End time is required'
										}
									})}
									className="form-control date"
								/>
								<label className="form-label" htmlFor="canMove">
									Can move
								</label>
								<input type="checkbox" id="canMove" {...register('canMove')} className="form-check-input" />
								<label className="form-label" htmlFor="canChangeGroup">
									Can change group
								</label>
								<input type="checkbox" id="canChangeGroup" {...register('canChangeGroup')} className="form-check-input" />
							</form>
						</div>
					</div>
				</Modal.Body>
				<Modal.Footer>
					<Button variant="light" onClick={handleClose}>
						Close
					</Button>
					<Button type="submit" form="addNewItem" variant="primary" onClick={() => onSubmitAction}>
						Add
					</Button>
				</Modal.Footer>
			</Modal>
		</>
	);
};

export default AddNewItemModal;
