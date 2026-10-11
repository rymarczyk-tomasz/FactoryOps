import { ReactNode } from 'react';
import { Modal } from 'react-bootstrap';
import './modals.css';

const MOUSE: [ReactNode, string][] = [
	['klik', 'szczegóły zlecenia w panelu obok planu'],
	['Ctrl / Shift + klik', 'dołóż zlecenie do zaznaczenia - prawy klik na nim ustawia materiał i program dla wszystkich zaznaczonych'],
	['dwuklik', 'na pustym miejscu - nowe zlecenie od tej godziny; na zleceniu - edycja'],
	['przeciąganie', 'przeniesienie zlecenia w czasie lub na inny wiersz (w starym miejscu zostaje przerwa); zlecenie „Bez maszyny” upuść na wiersz, żeby je przypisać'],
	['prawy klik na wierszu', 'nowe zlecenie od tej godziny, domknięcie przerwy, awaria maszyny, dzień pracujący / wolny'],
	['prawy klik na zleceniu', 'to samo oraz „Materiał gotowy” i „Program gotowy”'],
	['klik w dzień', 'w nagłówku planu - kalendarz dnia dla zakładu, linii i maszyn'],
	['Shift + kółko', 'przewijanie planu w czasie (albo pasek pod planem)']
];

const KEYBOARD: [ReactNode, string, string][] = [
	['/', 'plan, lista', 'szukaj'],
	['Enter / Shift+Enter', 'wyszukiwanie na planie', 'następny / poprzedni wynik'],
	['Esc', 'plan', 'zamyka podpowiedź, potem panel zlecenia; w polu wyszukiwania czyści je'],
	['Esc', 'menu, okna', 'zamknij'],
	['Ctrl+Z', 'poza polami tekstowymi i oknami', 'cofnij ostatnią zmianę'],
	['Ctrl+Enter', 'nowe zlecenie', 'zapisz i dodaj kolejne'],
	['strzałki, Home, End', 'przełączniki, kolory', 'zmiana wyboru'],
	['Shift + klik', 'lista', 'zaznacz zakres wierszy; na nagłówku - kolejny poziom sortowania'],
	['?', 'plan', 'ta ściągawka']
];

const Keys = ({ children }: { children: ReactNode }) => <kbd className="help-kbd">{children}</kbd>;

interface HelpModalProps {
	show: boolean;
	onHide: () => void;
}

/** Ściągawka „Jak to działa”: mysz, klawiatura i kalendarz - pełna lista zamiast długiej stopki planu. */
const HelpModal = ({ show, onHide }: HelpModalProps) => (
	<Modal show={show} onHide={onHide} centered size="lg" scrollable>
		<Modal.Header closeButton closeLabel="Zamknij">
			<Modal.Title>Jak to działa</Modal.Title>
		</Modal.Header>
		<Modal.Body className="help-body">
			<section>
				<h3 className="section-label">Mysz</h3>
				<dl className="help-list">
					{MOUSE.map(([keys, text]) => (
						<div key={text}>
							<dt>
								<Keys>{keys}</Keys>
							</dt>
							<dd>{text}</dd>
						</div>
					))}
				</dl>
			</section>
			<section>
				<h3 className="section-label">Klawiatura</h3>
				<table className="help-table">
					<thead>
						<tr>
							<th>Klawisz</th>
							<th>Gdzie</th>
							<th>Co robi</th>
						</tr>
					</thead>
					<tbody>
						{KEYBOARD.map(([keys, where, text]) => (
							<tr key={`${keys}-${where}`}>
								<td>
									<Keys>{keys}</Keys>
								</td>
								<td>{where}</td>
								<td>{text}</td>
							</tr>
						))}
					</tbody>
				</table>
			</section>
			<section>
				<h3 className="section-label">Kalendarz</h3>
				<p className="help-lead">Jedna maszyna pracuje w weekend (np. w sobotę):</p>
				<ol className="help-steps">
					<li>
						Kliknij <Keys>prawym</Keys> na wierszu maszyny w ten dzień.
					</li>
					<li>
						Wybierz <b>Dzień pracujący / wolny…</b>
					</li>
					<li>
						W części <b>Wyjątki dla linii i maszyn</b> ustaw tej maszynie <b>Pracuje</b> albo <b>Tylko w godzinach…</b> (np. 6–18). Cały zakład zostaje
						„Normalnie”.
					</li>
					<li>
						<b>Zapisz</b> - zlecenia maszyny przesuną się na ten dzień. Wyjątek widać jako kropkę w nagłówku dnia.
					</li>
				</ol>
				<p className="help-lead">Święto dla wszystkich: kliknij dzień w nagłówku planu i ustaw cały zakład na „Wolne”.</p>
			</section>
		</Modal.Body>
	</Modal>
);

export default HelpModal;
