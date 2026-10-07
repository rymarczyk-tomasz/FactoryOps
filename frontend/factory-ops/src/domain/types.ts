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

/** Fizyczna maszyna. Może należeć do jednej linii produkcyjnej. */
export interface Machine {
	id: Id;
	name: string;
	/** Brak = 'weekdays' (dane zapisane przed dodaniem systemów pracy). */
	workMode?: WorkMode;
	/** Wyjątki tylko dla tej maszyny, mają pierwszeństwo przed kalendarzem zakładu. Klucz: 'YYYY-MM-DD'. */
	overrides?: Record<string, DayOverride>;
}

/**
 * Linia produkcyjna: grupa istniejących maszyn pracujących równolegle. Zlecenie przypisane do linii
 * dzieli się między jej maszyny, które w danej godzinie pracują i nie są zajęte własnym zleceniem.
 */
export interface Line {
	id: Id;
	name: string;
	/** Maszyny linii w kolejności wyświetlania. Maszyna należy do co najwyżej jednej linii. */
	machineIds: Id[];
}

/** Dane z formularza maszyny. */
export interface MachineDraft {
	name: string;
	workMode: WorkMode;
	/** Linia, do której należy maszyna (brak = maszyna samodzielna). */
	lineId?: Id;
}

/** Dane z formularza linii. `newMachines` - maszyny tworzone razem z linią. */
export interface LineDraft {
	name: string;
	machineIds: Id[];
	newMachines?: { name: string; workMode: WorkMode }[];
	/** Ustawia ten system pracy wszystkim maszynom linii (brak = bez zmian). */
	workMode?: WorkMode;
}

/**
 * Awaria jednej maszyny od `start`. Bez `end` trwa nadal - rośnie razem z upływem czasu,
 * dopóki ktoś jej nie zakończy. Awarii nie planuje się z góry.
 */
export interface Breakdown {
	id: Id;
	machineId: Id;
	start: number;
	end?: number;
}

export interface Programmer {
	id: Id;
	name: string;
	surname: string;
}

/** Jeden bloczek pracy na maszynie (np. jeden stopień / operacja zamówienia). */
export interface Block {
	id: Id;
	/** Gdzie idzie zlecenie: maszyna albo cała linia (id linii). */
	machineId: Id;
	orderNo: string;
	/** Numer projektu, np. IMR-6001. */
	projectNo: string;
	/** Nazwa projektu, np. Huanyon. */
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

/**
 * Zlecenie przeniesione do archiwum (zakończone ponad 30 dni temu). Nie bierze udziału w planowaniu;
 * nazwa maszyny jest zapamiętana, bo maszynę mogą później usunąć.
 */
export interface ArchivedBlock extends Block {
	machineName: string;
	archivedAt: number;
}

export type BlockStatus = 'done' | 'in_progress' | 'planned';

/** Kalendarz zakładu - wyjątki dla wszystkich maszyn (np. święto, pracująca sobota). */
export interface WorkCalendar {
	/** Klucz: 'YYYY-MM-DD'. */
	overrides: Record<string, DayOverride>;
}

export interface PlanState {
	machines: Machine[];
	lines: Line[];
	programmers: Programmer[];
	blocks: Block[];
	/** Zlecenia zakończone dawno temu - tylko do wglądu na liście zleceń. */
	archive: ArchivedBlock[];
	calendar: WorkCalendar;
	breakdowns: Breakdown[];
}
