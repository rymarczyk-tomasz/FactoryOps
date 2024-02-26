import { Item } from '../models/Item';
import axios from 'axios';
import { Group } from '../models/Group';
import { Programmer } from '../models/Programmer';

export class ItemService {
	static getAllItems = async (): Promise<Item[]> => {
		const url = 'https://localhost:5005/items/';
		const result = await axios.get<Item[]>(url).then((x) => x.data);
		return result;
	};
}

export class GroupService {
	public static getAllGroups = (): Promise<Group[]> => {
		return axios.get<Group[]>('').then((x) => x.data);
	};
	public static getAllGroupsMock = (): Promise<Group[]> => {
		return new Promise((resolve, _) => {
			setTimeout(() => {
				resolve([
					{ id: 0, title: 'group 0', rightTitle: 'right_group_0', stackItems: true },
					{ id: 1, title: 'group 1', rightTitle: 'right_group_1', stackItems: true },
					{ id: 2, title: 'group 2', rightTitle: 'right_group_2', stackItems: true },
					{ id: 3, title: 'group 3', rightTitle: 'right_group_3', stackItems: true },
					{ id: 4, title: 'group 4', rightTitle: 'right_group_4', stackItems: true },
				]);
			}, 1000);
		});
	};
}

export class ProgrammerService {
	public static getAllProgrammers = async (): Promise<Programmer[]> => {
		return axios.get<Programmer[]>('https://localhost:5005/programmers/').then((x) => x.data);
	};
}