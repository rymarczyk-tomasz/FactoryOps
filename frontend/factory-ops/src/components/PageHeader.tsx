import { ReactNode } from 'react';

interface PageHeaderProps {
	title: string;
	/** Kontekst obok tytułu, np. zakres dat lub liczniki - pismem mono. */
	context?: ReactNode;
	/** Akcje strony, wyrównane do prawej. */
	children?: ReactNode;
}

/** Pasek górny strony: tytuł, kontekst i akcje. */
const PageHeader = ({ title, context, children }: PageHeaderProps) => (
	<header className="page-header">
		<h1 className="page-title">{title}</h1>
		{context !== undefined && <span className="page-context mono">{context}</span>}
		{children && <div className="page-header-actions">{children}</div>}
	</header>
);

export default PageHeader;
