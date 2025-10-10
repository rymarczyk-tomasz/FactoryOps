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
		// Use a provider-specific SQL fragment for default timestamps.
		// SQLite doesn't support now(); PostgreSQL uses now(); SQL Server uses GETUTCDATE()/SYSUTCDATETIME().
		var provider = this.Database.ProviderName;
		var nowSql = provider switch
		{
			"Microsoft.EntityFrameworkCore.Sqlite" => "CURRENT_TIMESTAMP",
			"Npgsql.EntityFrameworkCore.PostgreSQL" => "now()",
			"Microsoft.EntityFrameworkCore.SqlServer" => "GETUTCDATE()",
			_ => "CURRENT_TIMESTAMP",
		};

		modelBuilder.Entity<Item>().ToTable("WorkItems").Property(p => p.CreatedDate).HasDefaultValueSql(nowSql);
		modelBuilder.Entity<Groups>().ToTable("WorkingUnits").Property(p => p.CreatedDate).HasDefaultValueSql(nowSql);
		modelBuilder.Entity<Programmer>().ToTable("Programmers").Property(p => p.CreatedDate).HasDefaultValueSql(nowSql);
	}
}
