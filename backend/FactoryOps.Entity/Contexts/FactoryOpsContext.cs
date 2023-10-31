using FactoryOps.Entity.Configuration;
using FactoryOps.Entity.Models;
using Microsoft.EntityFrameworkCore;

namespace FactoryOps.Entity.Contexts;

public class FactoryOpsContext : DbContext
{
	public FactoryOpsContext(DbContextOptions<FactoryOpsContext> options)
		: base(options)
	{
	}

	internal DbSet<WorkItem> WorkItems { get; set; }

	protected override void OnModelCreating(ModelBuilder modelBuilder)
	{
		base.OnModelCreating(modelBuilder);

		modelBuilder.ApplyConfiguration(new WorkItemDtoConfiguration());
	}
}
