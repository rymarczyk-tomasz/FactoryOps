using FactoryOps.Entity.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FactoryOps.Entity.Configuration;
internal class DepartmentConfiguration : IEntityTypeConfiguration<Department>
{
	public void Configure(EntityTypeBuilder<Department> builder)
	{
		builder.HasKey(d => d.Id);
		builder.HasMany(d => d.WorkingUnits).WithOne();
	}
}
