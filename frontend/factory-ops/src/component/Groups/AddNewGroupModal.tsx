import React, { FC, useState } from 'react';
import { useForm } from 'react-hook-form';
import Modal from 'react-bootstrap/Modal';
import { Button, ModalHeader } from 'react-bootstrap';
import { CreateGroup } from '../../models/Group';

interface AddNewGroupProperties {
	createNewGroup: (group: CreateGroup) => void;
}

interface AddNewGroupForm {
	title: string;
}

const AddNewGroupModal: FC<AddNewGroupProperties> = (props: AddNewGroupProperties) => {
	const [showModal, setShowModal] = useState<boolean>(false);
	const {
		handleSubmit,
		register
	} = useForm<AddNewGroupForm>({
		defaultValues: {
			title: '',
		}
	});

	const handleClose = () => setShowModal(false);

	const onSubmitAction = (data: AddNewGroupForm) => {
		const group: CreateGroup = {
			title: data.title,
		};
		props.createNewGroup(group);
		handleClose();
	};

	return (
		<>
			<div className="me-2">
				<Button variant="primary" size={'sm'} onClick={() => setShowModal(true)}>
					Add group
				</Button>
			</div>
			<Modal show={showModal} onHide={handleClose}>
				<ModalHeader>
					<div>Add new Group</div>
				</ModalHeader>
				<Modal.Body>
					<div className="container d-flex">
						<div className="row">
							<form className="col-12" id="addNewGroup" onSubmit={handleSubmit(onSubmitAction)}>
								<label className="form-label" htmlFor="title">Group title</label>
								<input id="title" {...register('title', {
									required: {
										value: true,
										message: 'Title is required',
									},
									validate: (v: string) => (v && v.trim().length > 0) || 'Title cannot be empty'
								})} className="form-control" placeholder="Enter group title"/>
							</form>
						</div>
					</div>
				</Modal.Body>
				<Modal.Footer>
					<Button variant="light" onClick={handleClose}>
						Close
					</Button>
					<Button type="submit" form="addNewGroup" variant="primary" onClick={() => onSubmitAction}>
						Add
					</Button>
				</Modal.Footer>
			</Modal>
		</>
	);
};

export default AddNewGroupModal;
