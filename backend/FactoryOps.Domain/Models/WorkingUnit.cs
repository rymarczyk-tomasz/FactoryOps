namespace FactoryOps.Domain.Models;

public enum WorkingUnitState 
{
	Working,
	Breakdown,
}

/// <summary>
/// Machine/ place representation where item is making.
/// </summary>
public class WorkingUnit
{
	public Guid Id { get; set; }

	public WorkingUnitState State { get; set; } = WorkingUnitState.Working;

	public WorkItem CurrentDoing { get; set; } = new WorkItem();

	public Queue<WorkItem>? NextItemToDo { get; set; }
}