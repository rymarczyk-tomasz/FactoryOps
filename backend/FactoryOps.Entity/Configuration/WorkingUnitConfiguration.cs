using FactoryOps.Entity.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FactoryOps.Entity.Configuration;
internal class WorkingUnitConfiguration : IEntityTypeConfiguration<WorkingUnit>
{
	public void Configure(EntityTypeBuilder<WorkingUnit> builder)
	{
		builder.HasKey(t => t.Id);
		builder.HasOne(w => w.Department).WithMany(d => d.WorkingUnits).HasForeignKey(w => w.DepartmentId);
		builder.HasMany(d => d.WorkItems).WithMany();
	}
}
