import { Programmer } from './Programmer';

export interface ItemListModel {
	id: number;
	startDate: string;
	project: string;
	machine: string;
	machine_group: string;
	lengthOfHours: number;
	programmer?: Programmer;
}
