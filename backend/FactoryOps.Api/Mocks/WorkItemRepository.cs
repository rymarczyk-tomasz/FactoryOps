using FactoryOps.Domain.Models;
using FactoryOps.Domain.Ports;

namespace FactoryOps.Api.Mocks;
public class WorkItemRepository : IWorkItemsRepository
{
	private readonly List<WorkItem> mockMemoryDb;
	public WorkItemRepository(List<WorkItem> memoryDb)
	{
		this.mockMemoryDb = memoryDb;
	}
	public Task AddWorkItem(WorkItem item)
	{
		this.mockMemoryDb.Add(item);
		return Task.CompletedTask;
	}

	public Task DeleteWorkItem(string id)
	{
		var index = this.mockMemoryDb.FindIndex(x => x.Id.ToString() == id);
		this.mockMemoryDb.Remove(this.mockMemoryDb.ElementAt(index));
		return Task.CompletedTask;
	}

	public Task<WorkItem?> GetWorkItem(string id)
	{
		return Task.FromResult(this.mockMemoryDb.FirstOrDefault(x => x.Id.ToString() == id)); 
	}

	public Task<WorkItem[]> GetWorkItems()
	{
		return Task.FromResult(this.mockMemoryDb.ToArray());
	}

	public Task<WorkItem> UpdateWorkItem(string oldId, WorkItem newItem)
	{
		var index = this.mockMemoryDb.FindIndex(x => x.Id.ToString() == oldId);
		if (index == -1) this.mockMemoryDb[index] = newItem;
		return Task.FromResult(this.mockMemoryDb.ElementAt(index));
	}
}