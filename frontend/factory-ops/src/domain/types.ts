export type Id = string;

/**
 * weekdays - pon-pt, 3 zmiany, weekend wolny (chyba że ktoś przyjdzie - wyjątek w kalendarzu maszyny)
 * continuous - system 4-brygadowy, praca 24/7
 */
export type WorkMode = 'weekdays' | 'continuous';

export interface Machine {
	id: Id;
	name: string;
	/** Brak = 'weekdays' (dane zapisane przed dodaniem systemów pracy). */
	workMode?: WorkMode;
	/** Wyjątki tylko dla tej maszyny, mają pierwszeństwo przed kalendarzem zakładu. Klucz: 'YYYY-MM-DD'. */
	overrides?: Record<string, boolean>;
}

export interface Programmer {
	id: Id;
	name: string;
	surname: string;
}

/** Jeden bloczek pracy na maszynie (np. jeden stopień / operacja zamówienia). */
export interface Block {
	id: Id;
	machineId: Id;
	orderNo: string;
	project: string;
	operation: string;
	/** Godziny wpisane przez użytkownika; na planie zaokrąglane w górę do pełnych zmian. */
	hours: number;
	/** Początek pierwszej zmiany (ms). Wyliczany przez harmonogram. */
	start: number;
	/** Koniec ostatniej zmiany (ms). Wyliczany przez harmonogram. */
	end: number;
	programmerId?: Id;
	note?: string;
}

export type BlockDraft = Omit<Block, 'id' | 'start' | 'end'> & {
	/** Brak = dopisz na koniec kolejki maszyny. */
	start?: number;
};

export type BlockStatus = 'done' | 'in_progress' | 'planned';

/** Kalendarz zakładu - wyjątki dla wszystkich maszyn (np. święto, pracująca sobota). */
export interface WorkCalendar {
	/** Klucz: 'YYYY-MM-DD'. */
	overrides: Record<string, boolean>;
}

export interface PlanState {
	machines: Machine[];
	programmers: Programmer[];
	blocks: Block[];
	calendar: WorkCalendar;
}
