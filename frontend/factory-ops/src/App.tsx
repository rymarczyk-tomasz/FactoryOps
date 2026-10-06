import React, { useState } from 'react';
import { Button, Container, Nav, Navbar } from 'react-bootstrap';
import { NavLink, Route, Routes } from 'react-router-dom';
import ConfirmModal from './components/ConfirmModal';
import { usePlan } from './data/PlanContext';
import ListPage from './pages/ListPage';
import MachinesPage from './pages/MachinesPage';
import TimelinePage from './pages/TimelinePage';

function App() {
	const { resetDemo } = usePlan();
	const [confirmReset, setConfirmReset] = useState(false);

	return (
		<>
			<Navbar bg="dark" data-bs-theme="dark" expand="md">
				<Container fluid>
					<Navbar.Brand as={NavLink} to="/">
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
				<div className="card p-3">
					<Routes>
						<Route path="/" element={<TimelinePage />} />
						<Route path="/list" element={<ListPage />} />
						<Route path="/machines" element={<MachinesPage />} />
					</Routes>
				</div>
			</Container>
			<ConfirmModal show={confirmReset} title="Zresetować demo?" confirmLabel="Resetuj" onConfirm={resetDemo} onHide={() => setConfirmReset(false)}>
				Wszystkie zmiany zostaną utracone, a plan wróci do danych przykładowych.
			</ConfirmModal>
		</>
	);
}

export default App;
