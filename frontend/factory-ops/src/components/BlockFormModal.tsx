import React, { useEffect, useMemo, useState } from 'react';
import { Button, Col, Form, Modal, Row } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { usePlan } from '../data/PlanContext';
import { isLine, unitCount } from '../domain/calendar';
import { formatHours, fromLocalInputValue, programmerName, toLocalInputValue } from '../domain/format';
import { Block, BlockDraft, Id } from '../domain/types';

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
	orderNo: string;
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

const uniqueSorted = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pl'));

const BlockFormModal = ({ show, block, defaults, onHide }: BlockFormModalProps) => {
	const { state, addBlock, updateBlock } = usePlan();
	const isEdit = block !== undefined;
	const [addedCount, setAddedCount] = useState(0);
	const {
		register,
		handleSubmit,
		reset,
		watch,
		setFocus,
		formState: { errors }
	} = useForm<BlockForm>();

	// podpowiedzi z dotychczasowych zleceń
	const projects = useMemo(() => uniqueSorted(state.blocks.map((b) => b.project)), [state.blocks]);
	const operations = useMemo(() => uniqueSorted(state.blocks.map((b) => b.operation)), [state.blocks]);

	useEffect(() => {
		if (!show) return;
		const start = block?.start ?? defaults?.start;
		const machineId = block?.machineId ?? defaults?.machineId ?? (state.machines.some((m) => m.id === lastMachineId) ? lastMachineId : state.machines[0]?.id);
		reset({
			machineId: machineId ?? '',
			orderNo: block?.orderNo ?? '',
			project: block?.project ?? '',
			operation: block?.operation ?? '',
			hours: block?.hours ?? '',
			programmerId: block?.programmerId ?? '',
			startMode: start !== undefined ? 'manual' : 'queue',
			start: start !== undefined ? toLocalInputValue(start) : '',
			note: block?.note ?? ''
		});
		setAddedCount(0);
		// formularz ustawiamy tylko przy otwarciu, nie przy każdej zmianie planu
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [show]);

	const startMode = watch('startMode');
	const hours = Number(watch('hours'));
	const machine = state.machines.find((m) => m.id === watch('machineId'));

	/** Podpowiedź pod polem godzin: na linii czas dzieli się między maszyny (bez awarii, z dokładnością do godziny). */
	const hoursHint = () => {
		if (!(hours > 0)) return ' ';
		if (!isLine(machine)) return `Na planie: ${formatHours(hours)}`;
		const units = unitCount(machine);
		return `Linia, ${units} maszyny: ok. ${Math.ceil(hours / units)} h na planie`;
	};

	/** `again` - zapisz i zostań w formularzu, żeby wpisać kolejną operację tego samego zamówienia. */
	const submit = (again: boolean) =>
		handleSubmit((form) => {
			const draft: BlockDraft = {
				machineId: form.machineId,
				orderNo: form.orderNo.trim(),
				project: form.project.trim(),
				operation: form.operation.trim(),
				hours: Number(form.hours),
				programmerId: form.programmerId || undefined,
				note: form.note.trim() || undefined,
				start: form.startMode === 'manual' ? fromLocalInputValue(form.start) : undefined
			};
			if (isEdit) {
				updateBlock(block.id, { ...draft, start: draft.start ?? block.start });
				onHide();
				return;
			}
			addBlock(draft);
			lastMachineId = draft.machineId;
			if (!again) {
				onHide();
				return;
			}
			// zostają: zamówienie, projekt, maszyna, programista; czyścimy to, co dotyczy jednej operacji
			reset({ ...form, operation: '', hours: '', note: '', startMode: 'queue', start: '' });
			setAddedCount((n) => n + 1);
			setTimeout(() => setFocus('operation'));
		});

	const required = { required: 'Pole wymagane', validate: (v: string) => v.trim().length > 0 || 'Pole wymagane' };

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
				<Modal.Header closeButton>
					<Modal.Title>{isEdit ? 'Edytuj zlecenie' : 'Nowe zlecenie'}</Modal.Title>
				</Modal.Header>
				<Modal.Body>
					<Row className="g-3">
						<Form.Group as={Col} md={6} controlId="orderNo">
							<Form.Label>Nr zamówienia</Form.Label>
							<Form.Control autoFocus {...register('orderNo', required)} isInvalid={!!errors.orderNo} placeholder="np. ZAM/2026/0450" />
							<Form.Control.Feedback type="invalid">{errors.orderNo?.message}</Form.Control.Feedback>
						</Form.Group>
						<Form.Group as={Col} md={6} controlId="project">
							<Form.Label>Projekt</Form.Label>
							<Form.Control list="projectSuggestions" autoComplete="off" {...register('project', required)} isInvalid={!!errors.project} />
							<datalist id="projectSuggestions">
								{projects.map((p) => (
									<option key={p} value={p} />
								))}
							</datalist>
							<Form.Control.Feedback type="invalid">{errors.project?.message}</Form.Control.Feedback>
						</Form.Group>
						<Form.Group as={Col} md={6} controlId="operation">
							<Form.Label>Operacja / stopień</Form.Label>
							<Form.Control list="operationSuggestions" autoComplete="off" {...register('operation', required)} isInvalid={!!errors.operation} />
							<datalist id="operationSuggestions">
								{operations.map((o) => (
									<option key={o} value={o} />
								))}
							</datalist>
							<Form.Control.Feedback type="invalid">{errors.operation?.message}</Form.Control.Feedback>
						</Form.Group>
						<Form.Group as={Col} md={6} controlId="machineId">
							<Form.Label>Maszyna / linia</Form.Label>
							<Form.Select {...register('machineId', { required: 'Wybierz maszynę' })} isInvalid={!!errors.machineId}>
								{state.machines.map((m) => (
									<option key={m.id} value={m.id}>
										{isLine(m) ? `${m.name} (${unitCount(m)} maszyny)` : m.name}
									</option>
								))}
							</Form.Select>
							<Form.Control.Feedback type="invalid">{errors.machineId?.message}</Form.Control.Feedback>
						</Form.Group>
						<Form.Group as={Col} md={6} controlId="hours">
							<Form.Label>Czas pracy jednej maszyny [h]</Form.Label>
							<Form.Control
								type="number"
								step="0.5"
								min="0.5"
								{...register('hours', {
									required: 'Podaj liczbę godzin',
									validate: (v) => Number(v) >= 0.5 || 'Minimum 0,5 h'
								})}
								isInvalid={!!errors.hours}
							/>
							<Form.Text muted>{hoursHint()}</Form.Text>
							<Form.Control.Feedback type="invalid">{errors.hours?.message}</Form.Control.Feedback>
						</Form.Group>
						<Form.Group as={Col} md={6} controlId="programmerId">
							<Form.Label>Programista</Form.Label>
							<Form.Select {...register('programmerId')}>
								<option value="">— nie przypisano —</option>
								{state.programmers.map((p) => (
									<option key={p.id} value={p.id}>
										{programmerName(p)}
									</option>
								))}
							</Form.Select>
						</Form.Group>
						<Col md={6}>
							<Form.Label>Start</Form.Label>
							{!isEdit && <Form.Check type="radio" id="startQueue" value="queue" label="Na koniec kolejki maszyny" {...register('startMode')} />}
							<Form.Check type="radio" id="startManual" value="manual" label="Od wybranej godziny" {...register('startMode')} />
							{startMode === 'manual' && (
								<>
									<Form.Control
										type="datetime-local"
										step={3600}
										className="mt-2"
										{...register('start', { validate: (v) => startMode !== 'manual' || v !== '' || 'Podaj datę startu' })}
										isInvalid={!!errors.start}
									/>
									<Form.Text muted>Zostanie zaokrąglony do pełnej godziny.</Form.Text>
									<Form.Control.Feedback type="invalid">{errors.start?.message}</Form.Control.Feedback>
								</>
							)}
						</Col>
						<Form.Group as={Col} md={6} controlId="note">
							<Form.Label>Uwagi</Form.Label>
							<Form.Control as="textarea" rows={3} {...register('note')} />
						</Form.Group>
					</Row>
				</Modal.Body>
				<Modal.Footer>
					{!isEdit && (
						<span className="me-auto small text-secondary">
							{addedCount > 0 ? `Dodano ${addedCount} · ` : ''}Ctrl+Enter: zapisz i dodaj kolejne
						</span>
					)}
					<Button variant="light" onClick={onHide}>
						{addedCount > 0 ? 'Zamknij' : 'Anuluj'}
					</Button>
					{!isEdit && (
						<Button variant="outline-primary" onClick={submit(true)}>
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
