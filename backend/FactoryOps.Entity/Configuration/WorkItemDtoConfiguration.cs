using FactoryOps.Entity.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FactoryOps.Entity.Configuration;

internal class WorkItemDtoConfiguration : IEntityTypeConfiguration<WorkItem>
{
	public void Configure(EntityTypeBuilder<WorkItem> builder)
	{
		builder.HasKey(x => x.Id);
		builder.Property(x => x.Id).IsRequired();
		builder.HasIndex(x => x.Id).IsUnique();
	}
}
