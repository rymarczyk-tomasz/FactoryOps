import { Item } from '../models/Item';
import axios from 'axios';

export class ItemService {
	static getAllItems = async (): Promise<Item[]> => {
		const url = 'https://localhost:5005/items/';
		const result = await axios.get<Item[]>(url).then((x) => x.data);
		return result;
	};
}


