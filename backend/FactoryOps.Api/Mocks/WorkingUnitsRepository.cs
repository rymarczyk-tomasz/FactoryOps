using FactoryOps.Domain.Models;
using FactoryOps.Domain.Ports;

namespace FactoryOps.Api.Mocks;

public class WorkingUnitsRepository : IWorkingUnitsRepository
{
	private readonly List<WorkingUnit> mockMemoryDb;

	public WorkingUnitsRepository()
	{
		this.mockMemoryDb = new List<WorkingUnit>();
	}
	public Task AddWorkItem(WorkingUnit unit)
	{
		this.mockMemoryDb.Add(unit);
		return Task.CompletedTask;
	}

	public Task DeleteWorkItem(string id)
	{
		var index = this.mockMemoryDb.FindIndex(x => x.Id.ToString() == id);
		this.mockMemoryDb.Remove(this.mockMemoryDb.ElementAt(index));
		return Task.CompletedTask;
	}

	public Task<WorkingUnit?> GetWorkItem(string id)
	{
		return Task.FromResult(this.mockMemoryDb.FirstOrDefault(x => x.Id.ToString() == id));
	}

	public Task<WorkingUnit[]> GetWorkItems()
	{
		return Task.FromResult(this.mockMemoryDb.ToArray());
	}

	public Task<WorkingUnit> UpdateWorkItem(string oldId, WorkingUnit newUnit)
	{
		var index = this.mockMemoryDb.FindIndex(x => x.Id.ToString() == oldId);
		if (index == -1) this.mockMemoryDb[index] = newUnit;
		return Task.FromResult(this.mockMemoryDb.ElementAt(index));
	}
}
