namespace FactoryOps.Entity.Models;

public class WorkItem : BaseEntity
{
	public string Name { get; set; } = string.Empty;
	public string AdditionalInfo { get; set; } = string.Empty;
	public float TechnologicalHour { get; set; } = 0f;
	public float TechnologicalWorkingFactor { get; set; } = 7.2f;
	public DateTime Deadline { get; set; }
	public DateTime PlanedStart { get; set; }
}
