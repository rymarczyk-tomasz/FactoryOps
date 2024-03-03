import { Programmer } from './Programmer';

export interface ItemDto {
	id: number;
	group: number;
	title: string;
	startTime: string;
	length: number;
	programmer?: Programmer | undefined;
}