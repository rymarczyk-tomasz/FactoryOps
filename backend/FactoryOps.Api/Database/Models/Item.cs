namespace FactoryOps.Api.Database.Models;

public class Item : BaseEntity
{
	public int Group { get; set; }
	public string Title { get; set; } = string.Empty;
	public DateTime StartTime { get; set; }
	public int Length { get; set; }
	public bool CanMove { get; set; }
	public bool CanResize { get; set; }
	public bool CanChangeGroup { get; set; }
}
