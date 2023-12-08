using Microsoft.AspNetCore.Mvc;
using FactoryOps.Api.Database.Models;
using FactoryOps.Api.Database.Repositories;

namespace FactoryOps.Api.Controllers;

[ApiController]
[Route("units")]
public class WorkingUnitsController(IRepository<WorkingUnit> workingUnitsRepository) : ControllerBase
{
	[HttpGet]
	public ActionResult<IAsyncEnumerable<WorkingUnit>> GetWorkItems() => Ok(workingUnitsRepository.GetAll());

	[HttpGet]
	[Route("{id}")]
	public async Task<ActionResult<WorkingUnit>> GetWorkItem(int id) => Ok(await workingUnitsRepository.Get(id));

	[HttpPost]
	[Route("create")]
	public async Task<IActionResult> CreateWorkItem([FromBody] WorkingUnit workItem)
	{
		await workingUnitsRepository.Insert(workItem);
		return Ok();
	}

	[HttpPatch]
	[Route("{id}/update")]
	public async Task<IActionResult> UpdateWorkItemById([FromBody] WorkingUnit workItem)
	{
		await workingUnitsRepository.Update(workItem);
		return Ok();
	}

	[HttpDelete]
	[Route("{id}/delete")]
	public async Task<IActionResult> DeleteWorkItemById([FromBody] WorkingUnit item)
	{
		await workingUnitsRepository.Delete(item);
		return Ok();
	}

}
