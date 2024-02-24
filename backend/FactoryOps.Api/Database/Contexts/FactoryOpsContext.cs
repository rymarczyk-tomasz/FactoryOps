using FactoryOps.Api.Database.Models;
using Microsoft.EntityFrameworkCore;

namespace FactoryOps.Api.Database.Contexts;

public class FactoryOpsContext(DbContextOptions<FactoryOpsContext> options) : DbContext(options)
{
	public DbSet<Item> WorkItems { get; set; }
	public DbSet<Groups> WorkingUnits { get; set; }
	public DbSet<Programmer> Programmers { get; set; }

	protected override void OnConfiguring(DbContextOptionsBuilder options)
	{
	}
}
