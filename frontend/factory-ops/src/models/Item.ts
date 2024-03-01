import { Programmer } from './Programmer';

export type Item = {
	id: number;
	group: number;
	title: string;
	start_time: number;
	end_time: number;
	length: number;
	canMove: boolean;
	canResize: boolean;
	canChangeGroup: boolean;
	programmer?: Programmer;
}
