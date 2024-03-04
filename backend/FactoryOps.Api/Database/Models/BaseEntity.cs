using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FactoryOps.Api.Database.Models;

public class BaseEntity
{
	[DatabaseGenerated(DatabaseGeneratedOption.Identity)]
	public int Id { get; set; }
	[Required, DatabaseGenerated(DatabaseGeneratedOption.Computed)]
	public DateTime CreatedDate { get; set; }
}
