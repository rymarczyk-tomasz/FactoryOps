namespace FactoryOps.Entity.Models;
public class WorkingUnit : BaseEntity
{
	public ICollection<WorkItem> WorkItems { get; set; }

	// navigation properties
	public string DepartmentId { get; set; }
	public Department Department{ get; set; }
}
