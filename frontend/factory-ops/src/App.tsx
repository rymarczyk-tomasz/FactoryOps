import { useEffect, useState } from 'react';
import { Button, Toast, ToastContainer } from 'react-bootstrap';
import { Route, Routes } from 'react-router-dom';
import AppRail from './components/AppRail';
import ConfirmModal from './components/ConfirmModal';
import { usePlan } from './data/PlanContext';
import ListPage from './pages/ListPage';
import LoadPage from './pages/LoadPage';
import MachinesPage from './pages/MachinesPage';
import TimelinePage from './pages/TimelinePage';

const NOTICE_DELAY_MS = 6000;

/** Pole tekstowe, w którym pisze użytkownik - tam Ctrl+Z cofa wpisany tekst, nie zmianę planu. */
const isTyping = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

function App() {
	const { resetDemo, notice, dismissNotice, undo, canUndo } = usePlan();
	const [confirmReset, setConfirmReset] = useState(false);

	// Ctrl/⌘+Z cofa ostatnią zmianę planu (poza polami tekstowymi i otwartymi oknami)
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.key.toLowerCase() !== 'z') return;
			if (isTyping(e.target) || document.querySelector('.modal.show') || !canUndo) return;
			e.preventDefault();
			undo();
		};
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	}, [undo, canUndo]);

	return (
		<div className="app-shell">
			<AppRail onReset={() => setConfirmReset(true)} />
			<main className="app-main">
				<Routes>
					<Route path="/" element={<TimelinePage />} />
					<Route path="/list" element={<ListPage />} />
					<Route path="/load" element={<LoadPage />} />
					<Route path="/machines" element={<MachinesPage />} />
				</Routes>
				{/* komunikat na górze obszaru treści - nie przewija się razem ze stroną */}
				<ToastContainer position="top-center" containerPosition="absolute" className="notice-container">
					{notice && (
						<Toast key={notice.id} onClose={dismissNotice} delay={NOTICE_DELAY_MS} autohide>
							<Toast.Body className="d-flex align-items-center gap-3">
								<span className="notice-dot" />
								<span className="flex-grow-1 notice-text" title={notice.text}>
									{notice.text}
								</span>
								{notice.undoable && canUndo && (
									<Button size="sm" variant="light" className="py-1" onClick={undo}>
										Cofnij
									</Button>
								)}
								<button type="button" className="btn-close btn-close-white" aria-label="Zamknij" onClick={dismissNotice} />
							</Toast.Body>
						</Toast>
					)}
				</ToastContainer>
			</main>
			<ConfirmModal show={confirmReset} title="Zresetować demo?" confirmLabel="Resetuj" onConfirm={resetDemo} onHide={() => setConfirmReset(false)}>
				Wszystkie zmiany zostaną utracone, a plan wróci do danych przykładowych.
			</ConfirmModal>
		</div>
	);
}

export default App;
