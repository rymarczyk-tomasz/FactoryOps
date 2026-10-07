import { useState } from 'react';
import { Button, Container, Nav, Navbar, Toast, ToastContainer } from 'react-bootstrap';
import { NavLink, Route, Routes } from 'react-router-dom';
import ConfirmModal from './components/ConfirmModal';
import { usePlan } from './data/PlanContext';
import ListPage from './pages/ListPage';
import LoadPage from './pages/LoadPage';
import MachinesPage from './pages/MachinesPage';
import TimelinePage from './pages/TimelinePage';

const NOTICE_DELAY_MS = 6000;

const Logo = () => (
	<svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true" className="me-2">
		<rect x="1" y="1" width="24" height="24" rx="6" fill="#2563eb" />
		<rect x="5" y="7" width="10" height="3" rx="1.5" fill="#fff" />
		<rect x="9" y="12" width="12" height="3" rx="1.5" fill="#93c5fd" />
		<rect x="5" y="17" width="7" height="3" rx="1.5" fill="#fff" />
	</svg>
);

function App() {
	const { resetDemo, notice, dismissNotice, undo, canUndo } = usePlan();
	const [confirmReset, setConfirmReset] = useState(false);

	return (
		<>
			<Navbar bg="dark" data-bs-theme="dark" expand="md" className="app-navbar">
				<Container fluid>
					<Navbar.Brand as={NavLink} to="/" className="d-flex align-items-center fw-semibold">
						<Logo />
						FactoryOps
					</Navbar.Brand>
					<Navbar.Toggle aria-controls="main-nav" />
					<Navbar.Collapse id="main-nav">
						<Nav className="me-auto">
							<Nav.Link as={NavLink} to="/" end>
								Plan
							</Nav.Link>
							<Nav.Link as={NavLink} to="/list">
								Lista zleceń
							</Nav.Link>
							<Nav.Link as={NavLink} to="/load">
								Obciążenie
							</Nav.Link>
							<Nav.Link as={NavLink} to="/machines">
								Maszyny
							</Nav.Link>
						</Nav>
						<Button size="sm" variant="outline-light" onClick={() => setConfirmReset(true)}>
							Resetuj demo
						</Button>
					</Navbar.Collapse>
				</Container>
			</Navbar>
			<Container fluid className="py-3">
				<div className="card p-3 app-card">
					<Routes>
						<Route path="/" element={<TimelinePage />} />
						<Route path="/list" element={<ListPage />} />
						<Route path="/load" element={<LoadPage />} />
						<Route path="/machines" element={<MachinesPage />} />
					</Routes>
				</div>
			</Container>
			<ToastContainer position="top-center" className="mt-2 notice-container">
				{notice && (
					<Toast key={notice.id} onClose={dismissNotice} delay={NOTICE_DELAY_MS} autohide>
						<Toast.Body className="d-flex align-items-center gap-3">
							<span className="flex-grow-1 notice-text" title={notice.text}>
								{notice.text}
							</span>
							{notice.undoable && canUndo && (
								<Button size="sm" variant="outline-dark" className="py-0" onClick={undo}>
									Cofnij
								</Button>
							)}
							<button type="button" className="btn-close" aria-label="Zamknij" onClick={dismissNotice} />
						</Toast.Body>
					</Toast>
				)}
			</ToastContainer>
			<ConfirmModal show={confirmReset} title="Zresetować demo?" confirmLabel="Resetuj" onConfirm={resetDemo} onHide={() => setConfirmReset(false)}>
				Wszystkie zmiany zostaną utracone, a plan wróci do danych przykładowych.
			</ConfirmModal>
		</>
	);
}

export default App;
