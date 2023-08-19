using FactoryOps.Domain.Models;

namespace FactoryOps.Domain.Ports;

public interface IWorkingUnitsRepository
{
	public Task<WorkingUnit[]> GetWorkItems();
	public Task<WorkingUnit?> GetWorkItem(string id);
	public Task AddWorkItem(WorkingUnit unit);
	public Task DeleteWorkItem(string id);
	public Task<WorkingUnit> UpdateWorkItem(string oldId, WorkingUnit newUnit);
}