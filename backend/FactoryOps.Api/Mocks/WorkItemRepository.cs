using FactoryOps.Domain.Models;
using FactoryOps.Domain.Ports;

namespace FactoryOps.Api.Mocks;
public class WorkItemRepository : IWorkItemsRepository
{
	public Task AddWorkItem(WorkItem item)
	{
		throw new NotImplementedException();
	}

	public Task DeleteWorkItem(string id)
	{
		throw new NotImplementedException();
	}

	public Task<WorkItem> GetWorkItem(string id)
	{
		throw new NotImplementedException();
	}

	public Task<WorkItem[]> GetWorkItems()
	{
		throw new NotImplementedException();
	}

	public Task<WorkItem> UpdateWorkItem(string oldId, WorkItem newItem)
	{
		throw new NotImplementedException();
	}
}