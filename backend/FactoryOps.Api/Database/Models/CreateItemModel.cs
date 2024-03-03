namespace FactoryOps.Api.Database.Models;

public record CreateItemModel(
	int Group,
	string Title,
	string StartTime,
	int Length,
	Programmer? Programmer);