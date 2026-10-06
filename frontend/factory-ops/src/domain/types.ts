export type Id = string;

/**
 * weekdays - pon-pt, 3 zmiany, weekend wolny (chyba że ktoś przyjdzie - wyjątek w kalendarzu maszyny)
 * continuous - system 4-brygadowy, praca 24/7
 */
export type WorkMode = 'weekdays' | 'continuous';

/**
 * Godziny pracy w danym dniu, pełne godziny zegarowe. Doba trwa od 6:00 do 6:00,
 * więc np. { from: 6, to: 18 } to 6:00-18:00, a { from: 22, to: 6 } to noc do 6:00 następnego dnia.
 */
export interface WorkingHours {
	from: number;
	to: number;
}

/** Wyjątek dla dnia: cały dzień pracujący (true), wolny (false) albo tylko wybrane godziny. */
export type DayOverride = boolean | WorkingHours;

export interface Machine {
	id: Id;
	name: string;
	/** Brak = 'weekdays' (dane zapisane przed dodaniem systemów pracy). */
	workMode?: WorkMode;
	/** Wyjątki tylko dla tej maszyny, mają pierwszeństwo przed kalendarzem zakładu. Klucz: 'YYYY-MM-DD'. */
	overrides?: Record<string, DayOverride>;
	/**
	 * Ile jednakowych maszyn pracuje równolegle - linia produkcyjna to 3, zwykła maszyna 1 (brak = 1).
	 * Zlecenie na linii dzieli się między pracujące maszyny, więc trwa krócej.
	 */
	units?: number;
}

/** Awaria: wybrane maszyny (numery w linii, od 0) stoją w przedziale [start, end). */
export interface Breakdown {
	id: Id;
	machineId: Id;
	units: number[];
	start: number;
	end: number;
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
	/** Godziny pracy jednej maszyny z przewodnika; linia dzieli je między pracujące maszyny. Plan liczy pełne godziny. */
	hours: number;
	/** Początek (ms, pełna godzina). Wyliczany przez harmonogram. */
	start: number;
	/** Koniec (ms, pełna godzina, z pominięciem czasu wolnego i awarii). Wyliczany przez harmonogram. */
	end: number;
	/**
	 * Termin, przed którym zlecenie nie startuje - ustawiany, gdy zlecenie postawiono celowo z przerwą
	 * (np. czeka na materiał). Bez niego zlecenie „przykleja się” do poprzedniego i cofa się razem z kolejką.
	 */
	pinnedStart?: number;
	programmerId?: Id;
	note?: string;
}

export type BlockDraft = Omit<Block, 'id' | 'start' | 'end' | 'pinnedStart'> & {
	/** Brak = dopisz na koniec kolejki maszyny. */
	start?: number;
};

export type BlockStatus = 'done' | 'in_progress' | 'planned';

/** Kalendarz zakładu - wyjątki dla wszystkich maszyn (np. święto, pracująca sobota). */
export interface WorkCalendar {
	/** Klucz: 'YYYY-MM-DD'. */
	overrides: Record<string, DayOverride>;
}

export interface PlanState {
	machines: Machine[];
	programmers: Programmer[];
	blocks: Block[];
	calendar: WorkCalendar;
	breakdowns: Breakdown[];
}
