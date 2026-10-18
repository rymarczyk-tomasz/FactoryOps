import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Button, Form, Modal } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { usePlan } from '../data/PlanContext';
import { findLine, lineMachines, lineOfMachine, resourceName, standaloneMachines } from '../domain/calendar';
import { formatClockDuration, formatClockSpan, formatDateTime, fromLocalInputValue, programmerName, toLocalInputValue } from '../domain/format';
import { projectKey, projectOperations } from '../domain/projects';
import { nearestHourStart } from '../domain/shifts';
import { Block, BlockDraft, Id } from '../domain/types';
import { machinesLabel, previewPlacement } from './planSelectors';
import './modals.css';
import ColorSwatches from './ColorSwatches';
import OrderName from './OrderName';
import { projectColor, recolorNote } from './projectColor';
import Segmented from './Segmented';

export interface BlockFormDefaults {
	machineId?: Id;
	start?: number;
}

interface BlockFormModalProps {
	show: boolean;
	/** Edytowany bloczek; brak = dodawanie nowego. */
	block?: Block;
	defaults?: BlockFormDefaults;
	onHide: () => void;
}

interface BlockForm {
	machineId: Id;
	projectNo: string;
	project: string;
	operation: string;
	/** Pusty string, dopóki użytkownik nic nie wpisze (pole liczbowe). */
	hours: number | '';
	programmerId: Id;
	startMode: 'queue' | 'manual';
	start: string;
	note: string;
}

/** Maszyna z ostatnio dodanego zlecenia - Adam zwykle wpisuje kilka zleceń na tę samą maszynę. */
let lastMachineId: Id | undefined;
const timeFormat = new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit' });

const uniqueSorted = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pl'));

const BlockFormModal = ({ show, block, defaults, onHide }: BlockFormModalProps) => {
	const { state, now, addBlock, updateBlock } = usePlan();
	const isEdit = block !== undefined;
	const [addedCount, setAddedCount] = useState(0);
	/** Numer projektu, z którego uzupełniono nazwę - do czasu ręcznej zmiany nazwy. */
	const [filledFrom, setFilledFrom] = useState<string>();
	/** Kolor wybrany w formularzu; brak - kolor projektu (zapisany albo z numeru). */
	const [pickedColor, setPickedColor] = useState<string>();
	const {
		register,
		handleSubmit,
		reset,
		watch,
		setFocus,
		setValue,
		getValues,
		formState: { errors }
	} = useForm<BlockForm>();

	// podpowiedzi z dotychczasowych zleceń
	const projects = useMemo(() => uniqueSorted(state.blocks.map((b) => b.project)), [state.blocks]);
	const projectNos = useMemo(() => uniqueSorted(state.blocks.map((b) => b.projectNo)), [state.blocks]);
	/** Nazwa projektu po numerze - z ostatniego zlecenia tego projektu. */
	const projectNames = useMemo(() => new Map(state.blocks.filter((b) => b.projectNo).map((b) => [b.projectNo.toLowerCase(), b.project])), [state.blocks]);

	useEffect(() => {
		if (!show) return;
		const start = block?.start ?? defaults?.start;
		const exists = (id: Id | undefined) => id !== undefined && (state.machines.some((m) => m.id === id) || state.lines.some((l) => l.id === id));
		const machineId = block?.machineId ?? defaults?.machineId ?? (exists(lastMachineId) ? lastMachineId : (state.lines[0]?.id ?? state.machines[0]?.id));
		reset({
			machineId: machineId ?? '',
			projectNo: block?.projectNo ?? '',
			project: block?.project ?? '',
			operation: block?.operation ?? '',
			hours: block?.hours ?? '',
			programmerId: block?.programmerId ?? '',
			startMode: start !== undefined ? 'manual' : 'queue',
			start: start !== undefined ? toLocalInputValue(start) : '',
			note: block?.note ?? ''
		});
		setAddedCount(0);
		setFilledFrom(undefined);
		setPickedColor(undefined);
		// formularz ustawiamy tylko przy otwarciu, nie przy każdej zmianie planu
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [show]);

	const startMode = watch('startMode');
	const hours = Number(watch('hours'));
	const machineId = watch('machineId');
	const start = watch('start');
	const programmerId = watch('programmerId');
	const projectNo = watch('projectNo') ?? '';
	const projectName = watch('project') ?? '';
	// wpisany istniejący numer projektu od razu pokazuje jego kolor
	const color = pickedColor ?? projectColor({ projectNo, project: projectName }, state.projects);
	/** Stopnie / detale już wpisane w tym projekcie. */
	const operations = useMemo(() => projectOperations(state.blocks, projectKey({ projectNo, project: projectName })), [state.blocks, projectNo, projectName]);
	const line = findLine(state.lines, machineId);

	/** Wybrany zasób w polu: nazwa mono + opis szary. */
	const resourceValue = () => {
		if (!machineId) return <span className="select-display-placeholder">— wybierz —</span>;
		const ownLine = lineOfMachine(state.lines, machineId);
		const desc = line ? `cała linia · ${machinesLabel(line.machineIds.length)}` : ownLine ? `tylko ta maszyna · ${ownLine.name}` : 'maszyna';
		return (
			<>
				<span className="select-display-name">{resourceName(state, machineId)}</span>
				<span className="select-display-desc">{desc}</span>
			</>
		);
	};

	/** Gdzie wyląduje zlecenie: ta sama logika co przy zapisie, liczona na szkicu. */
	const placement = useMemo(() => {
		if (!show || !machineId || !(hours >= 0.5)) return undefined;
		const manual = startMode === 'manual';
		if (manual && !start) return undefined;
		const draft: BlockDraft = {
			...(block ?? { projectNo: '', project: '', operation: '' }),
			machineId,
			hours,
			start: manual ? fromLocalInputValue(start) : undefined
		};
		const placed = previewPlacement(state, isEdit ? { ...draft, start: draft.start ?? block.start } : draft, now, block?.id);
		return placed && { ...placed, requested: draft.start ?? block?.start };
	}, [show, state, now, block, isEdit, machineId, startMode, start, hours]);

	/**
	 * Podpowiedź pod polem godzin: godziny technologiczne → czas zegarowy na planie (koniec minus start po ułożeniu
	 * planu), czyli z czasem wolnym, awariami i - na linii - podziałem między pracujące maszyny.
	 */
	const hoursHint = (): ReactNode => {
		if (!(hours > 0)) return ' ';
		const work = `${String(hours).replace('.', ',')} h pracy`;
		const onLine = line ? ` · linia, ${machinesLabel(line.machineIds.length)}` : '';
		if (!placement) return `${work}${onLine}`;
		return (
			<>
				{work} → na planie <b>{formatClockDuration(placement.end - placement.start)} zegarowo</b> ({formatClockSpan(placement.start, placement.end)}){onLine}
			</>
		);
	};

	/** Podgląd terminu pod formularzem. */
	const preview = useMemo((): ReactNode => {
		if (!show || !machineId) return undefined;
		const name = resourceName(state, machineId);
		const manual = startMode === 'manual';
		if (manual && !start) return `${name} · podaj start`;
		if (!(hours >= 0.5)) {
			const last = state.blocks.filter((b) => b.machineId === machineId).reduce<Block | undefined>((l, b) => (!l || b.end > l.end ? b : l), undefined);
			return last ? (
				<>
					{name} · na koniec kolejki po <OrderName block={last} /> · podaj czas pracy, żeby zobaczyć termin
				</>
			) : (
				`${name} · podaj czas pracy, żeby zobaczyć termin`
			);
		}
		const placed = placement;
		if (!placed) return name;
		const { after, before } = placed;
		if (manual || isEdit) {
			// wpisana godzina zajęta albo poza czasem pracy - bez wyjaśnienia inny start wyglądałby jak błąd
			const requested = nearestHourStart(placed.requested!);
			const sameDay = new Date(requested).toDateString() === new Date(placed.start).toDateString();
			const at = (ms: number) => (sameDay ? timeFormat.format(ms) : formatDateTime(ms));
			const busyBy = after && after.end > requested ? after : undefined;
			return (
				<>
					{name} · {formatDateTime(placed.start)} → {formatDateTime(placed.end)}
					{after && (
						<>
							{' '}
							· po <OrderName block={after} />
							{after.end < placed.start && ' (z przerwą)'}
						</>
					)}
					{before && (
						<>
							{' '}
							· przed <OrderName block={before} />
						</>
					)}
					{placed.start !== requested && (
						<span className="form-preview-warn">
							start przesunięty z {at(requested)} na {at(placed.start)} –{' '}
							{busyBy ? (
								<>
									wcześniej zajęte przez <OrderName block={busyBy} />
								</>
							) : (
								'wcześniej maszyna nie pracuje'
							)}
						</span>
					)}
				</>
			);
		}
		return (
			<>
				{name} ·{' '}
				{after && (
					<>
						po <OrderName block={after} /> ·{' '}
					</>
				)}
				start {formatDateTime(placed.start)} → koniec {formatDateTime(placed.end)}
			</>
		);
	}, [show, state, machineId, startMode, start, hours, placement, isEdit]);

	/** Znany numer projektu od razu podpowiada jego nazwę. */
	const fillProjectName = (projectNo: string) => {
		// inny projekt - kolor znowu wynika z projektu, a nie z poprzedniego wyboru
		setPickedColor(undefined);
		const name = projectNames.get(projectNo.trim().toLowerCase());
		if (!name) return;
		if (getValues('project') !== name) setValue('project', name, { shouldValidate: true });
		setFilledFrom(projectNo.trim());
	};

	/** `again` - zapisz i zostań w formularzu, żeby wpisać kolejny stopień tego samego projektu. */
	const submit = (again: boolean) =>
		handleSubmit((form) => {
			const draft: BlockDraft = {
				machineId: form.machineId,
				// numer zamówienia nie jest już wpisywany - edycja zachowuje numer z importu lub starszych danych
				orderNo: block?.orderNo,
				projectNo: form.projectNo.trim(),
				project: form.project.trim(),
				operation: form.operation.trim(),
				hours: Number(form.hours),
				programmerId: form.programmerId || undefined,
				note: form.note.trim() || undefined,
				start: form.startMode === 'manual' ? fromLocalInputValue(form.start) : undefined
			};
			// kolor zapisujemy na projekcie tylko wtedy, gdy planista go zmienił
			const chosen = pickedColor !== undefined && pickedColor !== projectColor(draft, state.projects) ? pickedColor : undefined;
			if (isEdit) {
				updateBlock(block.id, { ...draft, start: draft.start ?? block.start }, chosen);
				onHide();
				return;
			}
			addBlock(draft, chosen);
			lastMachineId = draft.machineId;
			if (!again) {
				onHide();
				return;
			}
			// zostają: numer i nazwa projektu, maszyna, programista; czyścimy to, co dotyczy jednego stopnia
			reset({ ...form, operation: '', hours: '', note: '', startMode: 'queue', start: '' });
			setPickedColor(undefined);
			setAddedCount((n) => n + 1);
			setTimeout(() => setFocus('operation'));
		});

	const required = { required: 'Pole wymagane', validate: (v: string) => v.trim().length > 0 || 'Pole wymagane' };
	const setStartMode = (mode: BlockForm['startMode']) => setValue('startMode', mode);

	return (
		<Modal show={show} onHide={onHide} centered size="lg">
			<Form
				noValidate
				onSubmit={submit(false)}
				onKeyDown={(e) => {
					if (!isEdit && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
						e.preventDefault();
						submit(true)();
					}
				}}>
				<Modal.Header closeButton closeLabel="Zamknij">
					<Modal.Title>{isEdit ? 'Edytuj zlecenie' : 'Nowe zlecenie'}</Modal.Title>
				</Modal.Header>
				<Modal.Body className="form-grid">
					<Form.Group controlId="projectNo">
						<Form.Label>Nr projektu</Form.Label>
						<Form.Control
							autoFocus
							className="mono"
							list="projectNoSuggestions"
							autoComplete="off"
							placeholder="np. IMR-6001"
							{...register('projectNo', { ...required, onChange: (e) => fillProjectName(e.target.value) })}
							isInvalid={!!errors.projectNo}
						/>
						<datalist id="projectNoSuggestions">
							{projectNos.map((p) => (
								<option key={p} value={p} />
							))}
						</datalist>
						<Form.Control.Feedback type="invalid">{errors.projectNo?.message}</Form.Control.Feedback>
						<div className="form-swatches">
							<span className="form-swatches-label">Kolor projektu</span>
							<ColorSwatches label="Kolor projektu" value={color} onChange={setPickedColor} size="sm" />
						</div>
						{recolorNote(state.blocks, projectKey({ projectNo, project: projectName })) && (
							<div className="swatch-note">{recolorNote(state.blocks, projectKey({ projectNo, project: projectName }))}</div>
						)}
					</Form.Group>
					<Form.Group controlId="project">
						<Form.Label>Nazwa projektu</Form.Label>
						<div className={`field-addon ${filledFrom ? 'is-filled' : ''}`}>
							<Form.Control
								list="projectSuggestions"
								autoComplete="off"
								placeholder="np. Huanyon"
								{...register('project', { ...required, onChange: () => setFilledFrom(undefined) })}
								isInvalid={!!errors.project}
							/>
							{filledFrom && <span className="field-addon-text is-filled">uzupełniono z {filledFrom}</span>}
						</div>
						<datalist id="projectSuggestions">
							{projects.map((p) => (
								<option key={p} value={p} />
							))}
						</datalist>
						{errors.project && <Form.Control.Feedback type="invalid" className="d-block">{errors.project.message}</Form.Control.Feedback>}
					</Form.Group>
					<Form.Group controlId="operation">
						<Form.Label>Stopień / detal</Form.Label>
						<Form.Control
							list="operationSuggestions"
							autoComplete="off"
							placeholder="np. Stopień 3, Wirnik"
							{...register('operation', required)}
							isInvalid={!!errors.operation}
						/>
						<datalist id="operationSuggestions">
							{operations.map((o) => (
								<option key={o} value={o} />
							))}
						</datalist>
						<Form.Control.Feedback type="invalid">{errors.operation?.message}</Form.Control.Feedback>
					</Form.Group>
					<Form.Group controlId="machineId">
						<Form.Label>Linia / maszyna</Form.Label>
						<div className="select-display">
							<Form.Select {...register('machineId', { required: 'Wybierz maszynę' })} isInvalid={!!errors.machineId}>
								{state.lines.map((l) => (
									<optgroup key={l.id} label={l.name}>
										<option value={l.id}>
											{l.name} - cała linia ({machinesLabel(l.machineIds.length)})
										</option>
										{lineMachines(l, state.machines).map((m) => (
											<option key={m.id} value={m.id}>
												{'   '}
												{m.name} - tylko ta maszyna
											</option>
										))}
									</optgroup>
								))}
								<optgroup label="Maszyny">
									{standaloneMachines(state).map((m) => (
										<option key={m.id} value={m.id}>
											{m.name}
										</option>
									))}
								</optgroup>
							</Form.Select>
							<span className="select-display-value">{resourceValue()}</span>
						</div>
						{errors.machineId && <Form.Control.Feedback type="invalid" className="d-block">{errors.machineId.message}</Form.Control.Feedback>}
					</Form.Group>
					<Form.Group controlId="hours">
						<Form.Label>Czas technologiczny (h)</Form.Label>
						<div className="field-addon">
							<Form.Control
								type="number"
								step="1"
								min="0"
								className="mono"
								{...register('hours', {
									required: 'Podaj liczbę godzin',
									validate: (v) => Number(v) >= 0.5 || 'Minimum 0,5 h'
								})}
								isInvalid={!!errors.hours}
							/>
							<span className="field-addon-text">h</span>
						</div>
						{errors.hours ? (
							<Form.Control.Feedback type="invalid" className="d-block">{errors.hours.message}</Form.Control.Feedback>
						) : (
							<Form.Text as="div">{hoursHint()}</Form.Text>
						)}
					</Form.Group>
					<Form.Group controlId="programmerId">
						<Form.Label>Programista</Form.Label>
						<Form.Select className={programmerId ? '' : 'is-unassigned'} {...register('programmerId')}>
							<option value="">— nie przypisano —</option>
							{state.programmers.map((p) => (
								<option key={p.id} value={p.id}>
									{programmerName(p)}
								</option>
							))}
						</Form.Select>
					</Form.Group>
					<div>
						<Form.Label as="div">Start</Form.Label>
						<input type="hidden" {...register('startMode')} />
						{!isEdit && (
							<Segmented
								block
								label="Start"
								value={startMode}
								onChange={setStartMode}
								options={[
									{ value: 'queue', label: 'Na koniec kolejki' },
									{ value: 'manual', label: 'Od wybranej godziny' }
								]}
							/>
						)}
						{startMode === 'manual' && (
							<>
								<Form.Control
									type="datetime-local"
									step={3600}
									aria-label="Start od godziny"
									className={`mono ${isEdit ? '' : 'mt-2'}`}
									{...register('start', { validate: (v) => startMode !== 'manual' || v !== '' || 'Podaj datę startu' })}
									isInvalid={!!errors.start}
								/>
								<Form.Control.Feedback type="invalid">{errors.start?.message}</Form.Control.Feedback>
								{!errors.start && <Form.Text as="div">Zostanie zaokrąglony do pełnej godziny.</Form.Text>}
							</>
						)}
					</div>
					{preview && (
						<div className="form-preview span-2" aria-live="polite">
							<span className="section-label">Podgląd</span>
							<span>{preview}</span>
						</div>
					)}
					<Form.Group controlId="note" className="span-2">
						<Form.Label>Uwagi</Form.Label>
						<Form.Control as="textarea" rows={2} placeholder="np. czeka na materiał, uwagi dla programisty…" {...register('note')} />
					</Form.Group>
				</Modal.Body>
				<Modal.Footer>
					{!isEdit && (
						<span className="modal-footer-hint mono">
							{addedCount > 0 ? `Dodano ${addedCount} · ` : ''}Ctrl+Enter · zapisz i dodaj kolejne
						</span>
					)}
					<Button variant="light" onClick={onHide}>
						{addedCount > 0 ? 'Zamknij' : 'Anuluj'}
					</Button>
					{!isEdit && (
						<Button variant="outline-secondary" onClick={submit(true)}>
							Zapisz i dodaj kolejne
						</Button>
					)}
					<Button type="submit" variant="primary">
						{isEdit ? 'Zapisz' : 'Dodaj'}
					</Button>
				</Modal.Footer>
			</Form>
		</Modal>
	);
};

export default BlockFormModal;
