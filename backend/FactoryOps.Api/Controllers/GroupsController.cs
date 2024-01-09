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
	[Route("create")]
	public async Task<IActionResult> CreateWorkItem([FromBody] Groups workItem)
	{
		await workingUnitsRepository.Insert(workItem);
		return Ok();
	}

	[HttpPatch]
	[Route("{id}/update")]
	public async Task<IActionResult> UpdateWorkItemById([FromBody] Groups workItem)
	{
		await workingUnitsRepository.Update(workItem);
		return Ok();
	}

	[HttpDelete]
	[Route("{id}/delete")]
	public async Task<IActionResult> DeleteWorkItemById([FromBody] Groups item)
	{
		await workingUnitsRepository.Delete(item);
		return Ok();
	}

}
