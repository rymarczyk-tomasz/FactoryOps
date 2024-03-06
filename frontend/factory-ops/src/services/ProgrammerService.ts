import axios from 'axios';
import { Programmer } from '../models/Programmer';

export class ProgrammerService {
	public static getAllProgrammers = async (): Promise<Programmer[]> => {
		return axios.get<Programmer[]>('https://localhost:5005/programmers/').then((x) => x.data);
	};
}
