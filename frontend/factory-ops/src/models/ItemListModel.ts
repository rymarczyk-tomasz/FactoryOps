import { Programmer } from './Programmer';

export interface ItemListModel {
	id: number;
	startDate: string;
	project: string;
	machine: string;
	machine_group: string;
	programmer?: Programmer;
}
