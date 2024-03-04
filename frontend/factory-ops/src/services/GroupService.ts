import axios from 'axios';
import { Group } from '../models/Group';


export class GroupService {
	public static getAllGroups = async (): Promise<Group[]> => {
		return await axios.get<Group[]>('https://localhost:5005/groups').then((x) => x.data);
	};
}
