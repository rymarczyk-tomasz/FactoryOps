using FactoryOps.Api.Database.Models;
using Microsoft.EntityFrameworkCore;

namespace FactoryOps.Api.Database.Contexts;

public class FactoryOpsContext : DbContext
{
	public FactoryOpsContext(DbContextOptions<FactoryOpsContext> options) : base(options)
	{
	}

	public DbSet<WorkItem> WorkItems { get; set; }
	public DbSet<WorkingUnit> WorkingUnits { get; set; }
	public DbSet<Department> Departments { get; set; }

	protected override void OnConfiguring(DbContextOptionsBuilder options)
	{
	}
}
