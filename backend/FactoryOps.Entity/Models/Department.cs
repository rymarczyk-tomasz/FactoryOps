namespace FactoryOps.Entity.Models;
public class Department : BaseEntity
{
	public virtual ICollection<WorkingUnit> WorkingUnits { get; set; } = new List<WorkingUnit>();
}
