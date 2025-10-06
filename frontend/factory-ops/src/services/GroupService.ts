import axios from 'axios';
import { CreateGroup, Group } from '../models/Group';

export class GroupService {
	public static getAllGroups = async (): Promise<Group[]> => {
		const url = 'https://localhost:5005/groups/';
		return await axios.get<Group[]>(url).then((x) => x.data);
	};

	public static create = async (group: CreateGroup): Promise<Group> => {
		const url = 'https://localhost:5005/groups/insertOrUpdate';
		return await axios.post<Group>(url, group).then((x) => x.data);
	};
}
