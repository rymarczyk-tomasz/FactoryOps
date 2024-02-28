import React, { FC, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import { Button } from 'react-bootstrap';

interface DeleteItemProperties {
	onDelete: () => void;
	itemName: string;
}
const DeleteItemModal: FC<DeleteItemProperties> = (props: DeleteItemProperties) => {
	const [showModal, setShowModal] = useState<boolean>(false);

	const handleClose = () => setShowModal(false);

	const handleDelete = () => {
		props.onDelete();
		handleClose();
	};

	return (
		<>
			<Button variant="danger" size={'sm'} onClick={() => setShowModal(true)}>
				Delete
			</Button>
			<Modal show={showModal} onHide={handleClose}>
				<Modal.Header closeButton>
					<Modal.Title>Confirm Deletion</Modal.Title>
				</Modal.Header>
				<Modal.Body>Are you sure you want to delete {props.itemName} item?</Modal.Body>
				<Modal.Footer>
					<Button variant="secondary" onClick={handleClose}>
						Cancel
					</Button>
					<Button variant="danger" onClick={handleDelete}>
						Delete
					</Button>
				</Modal.Footer>
			</Modal>
		</>
	);
};

export default DeleteItemModal;
