import { CreateItem } from '../models/CreateItemModel';
import axios from 'axios';
import { ItemDto } from '../models/ItemDto';

export class ItemService {
	static getAll = async (): Promise<ItemDto[]> => {
		const url = 'https://localhost:5005/items/';
		const result = await axios.get<ItemDto[]>(url).then((x) => x.data);
		console.log('getAll', result);
		return result;
	};

	static create = async (createItem: CreateItem): Promise<ItemDto> => {
		console.log('createItem', createItem);
		const url = 'https://localhost:5005/items/insertOrUpdate';
		const result = await axios.post<ItemDto>(url, createItem).then((x) => x.data);
		console.log('create', result);
		return result;
	};
}
