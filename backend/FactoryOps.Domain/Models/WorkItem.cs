namespace FactoryOps.Domain.Models;

public class WorkItem
{
	public Guid Id { get; set; }
	public string Name { get; set; } = string.Empty;
	public string AdditionalInfo { get; set; } = string.Empty;
}