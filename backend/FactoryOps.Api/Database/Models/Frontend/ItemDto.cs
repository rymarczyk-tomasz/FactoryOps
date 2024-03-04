namespace FactoryOps.Api.Database.Models.Frontend;

public record ItemDto(
	int? Id,
	int Group,
	string Title,
	string StartTime,
	int Length,
	Programmer? Programmer);