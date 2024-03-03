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
	
	protected override void OnModelCreating(ModelBuilder modelBuilder)
	{
		modelBuilder.Entity<Item>().ToTable("WorkItems").Property(p => p.CreatedDate).HasDefaultValueSql("now()");
		modelBuilder.Entity<Groups>().ToTable("WorkingUnits").Property(p => p.CreatedDate).HasDefaultValueSql("now()");
		modelBuilder.Entity<Programmer>().ToTable("Programmers").Property(p => p.CreatedDate).HasDefaultValueSql("now()");
	}
}
