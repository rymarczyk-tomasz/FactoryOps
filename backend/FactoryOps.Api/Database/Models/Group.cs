namespace FactoryOps.Api.Database.Models;
public class Groups : BaseEntity
{
	public string Title { get; set; } = string.Empty;
	public string? RightTitle { get; set; }
	public int? height { get; set; }
	public bool StackItems { get; set; } = true;
}
