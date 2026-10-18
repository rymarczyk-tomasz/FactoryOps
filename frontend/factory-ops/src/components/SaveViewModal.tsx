import { useEffect, useState } from 'react';
import { Button, Form, Modal } from 'react-bootstrap';
import './modals.css';

interface SaveViewModalProps {
	show: boolean;
	/** Opis zapisywanych ustawień, np. „Zaplanowane · Start +14 dni · sortuj: zasób, start”. */
	summary: string;
	onSave: (name: string) => void;
	onHide: () => void;
}

/** Nazwa nowego widoku listy - filtry i sortowanie zapisują się w tej przeglądarce. */
const SaveViewModal = ({ show, summary, onSave, onHide }: SaveViewModalProps) => {
	const [name, setName] = useState('');
	useEffect(() => {
		if (show) setName('');
	}, [show]);
	const trimmed = name.trim();
	return (
		<Modal show={show} onHide={onHide} centered dialogClassName="confirm-dialog">
			<Form
				onSubmit={(e) => {
					e.preventDefault();
					if (!trimmed) return;
					onSave(trimmed);
					onHide();
				}}>
				<Modal.Header closeButton closeLabel="Zamknij">
					<Modal.Title>Zapisz widok</Modal.Title>
				</Modal.Header>
				<Modal.Body className="modal-stack">
					<Form.Group controlId="viewName">
						<Form.Label>Nazwa</Form.Label>
						<Form.Control autoFocus autoComplete="off" placeholder="np. Do zaprogramowania · tydzień" value={name} onChange={(e) => setName(e.target.value)} />
					</Form.Group>
					<span className="modal-note">{summary}</span>
				</Modal.Body>
				<Modal.Footer>
					<Button variant="light" onClick={onHide}>
						Anuluj
					</Button>
					<Button type="submit" disabled={!trimmed}>
						Zapisz
					</Button>
				</Modal.Footer>
			</Form>
		</Modal>
	);
};

export default SaveViewModal;
