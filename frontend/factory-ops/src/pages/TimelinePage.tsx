import FactoryOpsTimeline from '../components/FactoryOpsTimeline';
import PageHeader from '../components/PageHeader';

const TimelinePage = () => (
	<>
		<PageHeader title="Plan" />
		<div className="page-body">
			<FactoryOpsTimeline />
		</div>
	</>
);

export default TimelinePage;
