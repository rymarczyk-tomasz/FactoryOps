export type Id = string;

export interface Machine {
	id: Id;
	name: string;
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

export interface WorkCalendar {
	/** Wyjątki od domyślnego kalendarza (pon-pt pracujące), klucz: 'YYYY-MM-DD'. */
	overrides: Record<string, boolean>;
}

export interface PlanState {
	machines: Machine[];
	programmers: Programmer[];
	blocks: Block[];
	calendar: WorkCalendar;
}
