import { ItemListModel } from './services/ItemListModel';

export const mockedData: ItemListModel[] = [
	{
		id: 1,
		startDate: '12.12.2024',
		project: 'Manzanillo',
		machine: 'HSTM 305',
		machine_group: 'HSTM 300',
	},
	{
		id: 2,
		startDate: '12.12.2024',
		project: 'HPC',
		machine: 'HSTM 502',
		machine_group: 'HSTM 500',
		programmer: {id: 2, name: 'John', surname: 'Doe'}
	},
	{
		id: 3,
		startDate: '12.12.2024',
		project: 'KOSOVO',
		machine: 'HSTM 308',
		machine_group: 'HSTM 300',
	},
	{
		id: 4,
		startDate: '12.12.2024',
		project: 'KOSOVO',
		machine: 'HSTM 305',
		machine_group: 'HSTM 300',
	},
	{
		id: 5,
		startDate: '12.12.2024',
		project: 'Manzanillo',
		machine: 'HSTM 305',
		machine_group: 'HSTM 300',
	},
	{
		id: 6,
		startDate: '12.12.2024',
		project: 'Manzanillo',
		machine: 'HSTM 305',
		machine_group: 'HSTM 300',
	},
	{
		id: 7,
		startDate: '12.12.2024',
		project: 'Manzanillo',
		machine: 'HSTM 305',
		machine_group: 'HSTM 300',
	}
];
