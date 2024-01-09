using FactoryOps.Api.Database.Models;
using Microsoft.EntityFrameworkCore;

namespace FactoryOps.Api.Database.Contexts;

public class FactoryOpsContext : DbContext
{
	public FactoryOpsContext(DbContextOptions<FactoryOpsContext> options) : base(options)
	{
	}

	public DbSet<Item> WorkItems { get; set; }
	public DbSet<Groups> WorkingUnits { get; set; }

	protected override void OnConfiguring(DbContextOptionsBuilder options)
	{
	}
}
