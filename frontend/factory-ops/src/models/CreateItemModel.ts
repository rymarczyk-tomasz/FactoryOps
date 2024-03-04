import { Programmer } from './Programmer';

export type CreateItem = {
	group: number;
	title: string;
	startTime: Date;
	length: number;
	programmer: Programmer | undefined;
}