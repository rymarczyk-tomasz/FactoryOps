using FactoryOps.Domain.Models;

namespace FactoryOps.Domain.Ports;

public interface IWorkItemsRepository
{
	public Task<WorkItem[]> GetWorkItems();
	public Task<WorkItem?> GetWorkItem(string id);
	public Task AddWorkItem(WorkItem item);
	public Task DeleteWorkItem(string id);
	public Task<WorkItem> UpdateWorkItem(string oldId, WorkItem newItem);
}