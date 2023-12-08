namespace FactoryOps.Api.Database.Models;
public class Department : BaseEntity
{
	public string DepartmentHead { get; set; } = string.Empty;
	public ICollection<WorkingUnit> WorkingUnits { get; set; } = new List<WorkingUnit>();
}
