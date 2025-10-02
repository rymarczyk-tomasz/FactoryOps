import axios from 'axios';
import { Programmer } from '../models/Programmer';


export class ProgrammerService {
	public static getAllProgrammers = async (): Promise<Programmer[]> => {
		const url = 'https://localhost:5005/programmers/';
		return axios.get<Programmer[]>(url).then((x) => x.data);
	};
}
