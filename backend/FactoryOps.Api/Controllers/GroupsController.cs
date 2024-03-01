using Microsoft.AspNetCore.Mvc;
using FactoryOps.Api.Database.Models;
using FactoryOps.Api.Database.Repositories;

namespace FactoryOps.Api.Controllers;

[ApiController]
[Route("groups")]
public class WorkingUnitsController(IRepository<Groups> workingUnitsRepository) : ControllerBase
{
	[HttpGet]
	public ActionResult<IAsyncEnumerable<Groups>> GetWorkItems() => Ok(workingUnitsRepository.GetAll());

	[HttpGet]
	[Route("{id}")]
	public async Task<ActionResult<Groups>> GetWorkItem(int id) => Ok(await workingUnitsRepository.Get(id));

	[HttpPost]
	[Route("insertOrUpdate")]
	public async Task<IActionResult> CreateWorkItem([FromBody] Groups workItem)
	{
		await workingUnitsRepository.InsertOrUpdate(workItem);
		return Ok();
	}

	[HttpDelete]
	[Route("/delete")]
	public async Task<IActionResult> DeleteWorkItemById([FromBody] Groups item)
	{
		await workingUnitsRepository.Delete(item);
		return Ok();
	}

}
