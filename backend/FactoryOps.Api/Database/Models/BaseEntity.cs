using System.ComponentModel.DataAnnotations.Schema;

namespace FactoryOps.Api.Database.Models;

public class BaseEntity
{
	[DatabaseGenerated(DatabaseGeneratedOption.Identity)]
	public int Id { get; set; }
	public DateTime CreatedDate { get; set; }
}
