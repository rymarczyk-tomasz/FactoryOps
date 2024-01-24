export interface Item {
	id: number;
	group: number;
	title: string;
	start_time: number;
	end_time: number;
	canMove: boolean;
	canResize: boolean;
	canChangeGroup: boolean;
}