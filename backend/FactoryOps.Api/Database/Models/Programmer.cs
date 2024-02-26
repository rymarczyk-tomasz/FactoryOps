namespace FactoryOps.Api.Database.Models;
public class Programmer : BaseEntity
{
	public string Name { get; init; } = string.Empty;
	public string Surname { get; init; } = string.Empty;
}
