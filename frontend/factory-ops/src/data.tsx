import { ItemListModel } from './models/ItemListModel';

// Funkcja generująca losową datę między 7 dni wstecz a 7 dni do przodu
function generateRandomDate(): string {
	const sevenDaysAgo: Date = new Date();
	sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

	const sevenDaysAhead: Date = new Date();
	sevenDaysAhead.setDate(sevenDaysAhead.getDate() + 7);

	const randomTime: number = sevenDaysAgo.getTime() + Math.random() * (sevenDaysAhead.getTime() - sevenDaysAgo.getTime());
	const randomDate: Date = new Date(randomTime);

	// Formatowanie daty
	const formattedDate: string = formatDate(randomDate);

	return formattedDate;
}

// Funkcja formatująca datę i godzinę w formacie "DD/MM/RR HH:MM"
function formatDate(date: Date): string {
	const day: string = ('0' + date.getDate()).slice(-2);
	const month: string = ('0' + (date.getMonth() + 1)).slice(-2);
	const year: string = date.getFullYear().toString().slice(-2);
	const hours: string = ('0' + date.getHours()).slice(-2);
	const minutes = '00';

	return `${day}/${month}/${year} ${hours}:${minutes}`;
}

export const mockedData: ItemListModel[] = [
	{
		id: 1,
		startDate: generateRandomDate(),
		project: 'Manzanillo',
		machine: 'HSTM 305',
		machine_group: 'HSTM 300'
	},
	{
		id: 2,
		startDate: generateRandomDate(),
		project: 'HPC',
		machine: 'HSTM 502',
		machine_group: 'HSTM 500',
		programmer: { id: 2, name: 'John', surname: 'Doe' }
	},
	{
		id: 3,
		startDate: generateRandomDate(),
		project: 'KOSOVO',
		machine: 'HSTM 308',
		machine_group: 'HSTM 300'
	},
	{
		id: 4,
		startDate: generateRandomDate(),
		project: 'KOSOVO',
		machine: 'HSTM 305',
		machine_group: 'HSTM 300'
	},
	{
		id: 5,
		startDate: generateRandomDate(),
		project: 'Manzanillo',
		machine: 'HSTM 305',
		machine_group: 'HSTM 300'
	},
	{
		id: 6,
		startDate: generateRandomDate(),
		project: 'Manzanillo',
		machine: 'HSTM 305',
		machine_group: 'HSTM 300'
	},
	{
		id: 7,
		startDate: generateRandomDate(),
		project: 'Manzanillo',
		machine: 'HSTM 305',
		machine_group: 'HSTM 300'
	}
];
