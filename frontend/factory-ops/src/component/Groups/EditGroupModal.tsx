import React, { FC, useState } from 'react';
import { useForm } from 'react-hook-form';
import Modal from 'react-bootstrap/Modal';
import { Button, ModalHeader } from 'react-bootstrap';
import { Group } from '../../models/Group';

interface EditGroupProperties {
	group: Group | undefined;
	UpdateGroup: (group: Group) => void;
}

interface EditGroupForm {
	title: string;
	stackItems: boolean;
}

const EditGroupModal: FC<EditGroupProperties> = (props: EditGroupProperties) => {
	const [showModal, setShowModal] = useState<boolean>(false);
	const { handleSubmit, register } = useForm<EditGroupForm>({
		defaultValues: {
			title: String(props.group?.title ?? ''),
			stackItems: props.group?.stackItems ?? false,
		},
	});

	const handleClose = () => setShowModal(false);

	const onSubmitAction = (data: EditGroupForm) => {
		const updated: Group = {
			id: props.group?.id ?? 0,
			title: data.title,
			stackItems: data.stackItems,
			rightTitle: props.group?.rightTitle,
			height: props.group?.height,
		};
		props.UpdateGroup(updated);
		handleClose();
	};

	const show = () => setShowModal(true);

	return (
		<>
			<div className="me-2">
				<Button variant="secondary" size={'sm'} onClick={show}>
					Edit
				</Button>
			</div>
			<Modal show={showModal} onHide={handleClose}>
				<ModalHeader>
					<div>Edit Group</div>
				</ModalHeader>
				<Modal.Body>
					{!props.group && <div className="container d-flex">Group not found</div>}
					{props.group && (
						<div className="container d-flex">
							<div className="row">
								<form className="col-12" id="editGroupForm" onSubmit={handleSubmit(onSubmitAction)}>
									<label className="form-label" htmlFor="title">
										Group title
									</label>
									<input
										id="title"
										{...register('title', {
											required: {
												value: true,
												message: 'Title is required',
											},
											validate: (v: string) => (v && v.trim().length > 0) || 'Title cannot be empty',
										})}
										className="form-control"
										defaultValue={String(props.group.title)}
									/>

									<div className="form-check mt-3">
										<input
											id="stackItems"
											type="checkbox"
											className="form-check-input"
											{...register('stackItems')}
											defaultChecked={props.group.stackItems ?? false}
										/>
										<label className="form-check-label" htmlFor="stackItems">
											Stack items in group
										</label>
									</div>
								</form>
							</div>
						</div>
					)}
				</Modal.Body>

				<Modal.Footer>
					<Button variant="light" onClick={handleClose}>
						Close
					</Button>
					<Button type="submit" form="editGroupForm" variant="primary" onClick={() => onSubmitAction}>
						Submit
					</Button>
				</Modal.Footer>
			</Modal>
		</>
	);
};

export default EditGroupModal;
