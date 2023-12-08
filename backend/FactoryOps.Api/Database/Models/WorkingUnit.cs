namespace FactoryOps.Api.Database.Models;
public class WorkingUnit : BaseEntity
{
	public string UnitName { get; set; } = string.Empty;
	public ICollection<WorkItem> WorkItems { get; set; } = new List<WorkItem>();
}
