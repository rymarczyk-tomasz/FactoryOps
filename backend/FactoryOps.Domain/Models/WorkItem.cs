namespace FactoryOps.Domain.Models;

public class WorkItem
{
	/// <summary>
	/// Unique ID 
	/// </summary>
	public Guid Id { get; set; }

	/// <summary>
	/// User specific item name.
	/// </summary>
	public string Name { get; set; } = string.Empty;
	
	/// <summary>
	/// User custom information related to item
	/// </summary>
	public string AdditionalInfo { get; set; } = string.Empty;
	
	/// <summary>
	/// How long many technological hours is needed to finish item.
	/// </summary>
	public float TechnologicalHour {get; set; } = 0;
	
	/// <summary>
	/// Date when item need to be finished.
	/// </summary> 
	public DateTime Deadline {get; set; }
}