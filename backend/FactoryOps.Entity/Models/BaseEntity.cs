using System.ComponentModel.DataAnnotations.Schema;

namespace FactoryOps.Entity.Models;

public class BaseEntity
{
	[DatabaseGenerated(DatabaseGeneratedOption.Identity)]
	public required string Id { get; set; }
	public DateTime CreatedDate { get; set; }
}
