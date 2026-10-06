import React, { ReactNode } from 'react';
import { Button, Modal } from 'react-bootstrap';

interface ConfirmModalProps {
	show: boolean;
	title: string;
	children: ReactNode;
	confirmLabel?: string;
	onConfirm: () => void;
	onHide: () => void;
}

const ConfirmModal = ({ show, title, children, confirmLabel = 'Usuń', onConfirm, onHide }: ConfirmModalProps) => (
	<Modal show={show} onHide={onHide} centered>
		<Modal.Header closeButton>
			<Modal.Title>{title}</Modal.Title>
		</Modal.Header>
		<Modal.Body>{children}</Modal.Body>
		<Modal.Footer>
			<Button variant="light" onClick={onHide}>
				Anuluj
			</Button>
			<Button
				variant="danger"
				onClick={() => {
					onConfirm();
					onHide();
				}}>
				{confirmLabel}
			</Button>
		</Modal.Footer>
	</Modal>
);

export default ConfirmModal;
