import axios from 'axios';
import { Group } from '../models/Group';

export class GroupService {
	public static getAllGroups = async (): Promise<Group[]> => {
		const url = 'https://localhost:5005/groups/';
		return await axios.get<Group[]>(url).then((x) => x.data);
	};
}
