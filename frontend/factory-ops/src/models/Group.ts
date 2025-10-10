export type Group = {
	id: number;
	title: React.ReactNode;
	rightTitle?: React.ReactNode | undefined;
	height?: number | undefined;
	stackItems?: boolean | undefined;
}

export type CreateGroup = {
	title: string;
}
