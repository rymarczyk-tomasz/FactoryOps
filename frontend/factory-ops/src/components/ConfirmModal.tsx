import { ReactNode } from 'react';
import { Button, Modal } from 'react-bootstrap';
import './modals.css';

interface ConfirmModalProps {
	show: boolean;
	title: string;
	children: ReactNode;
	confirmLabel?: string;
	/** Szary blok „Skutek” pod treścią, np. które zlecenia się przesuną. */
	impact?: ReactNode;
	/** Akcję da się cofnąć - dopisek o „Cofnij” i Ctrl+Z. */
	undoable?: boolean;
	onConfirm: () => void;
	onHide: () => void;
}

const ConfirmModal = ({ show, title, children, confirmLabel = 'Usuń', impact, undoable, onConfirm, onHide }: ConfirmModalProps) => (
	<Modal show={show} onHide={onHide} centered dialogClassName="confirm-dialog">
		<Modal.Header className="confirm-header">
			<Modal.Title>{title}</Modal.Title>
		</Modal.Header>
		<Modal.Body className="modal-stack confirm-body">
			<div>{children}</div>
			{impact && (
				<div className="impact-box">
					<span className="section-label">Skutek</span>
					<span>{impact}</span>
				</div>
			)}
			{undoable && <span className="modal-note">Można cofnąć przyciskiem „Cofnij” w komunikacie lub Ctrl+Z.</span>}
		</Modal.Body>
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
