using FactoryOps.Entity.Repositories;
using FactoryOps.Entity.Models;
using Microsoft.AspNetCore.Mvc;

namespace FactoryOps.Api.Controllers;

[ApiController]
[Route("units")]
public class WorkingUnitsController : ControllerBase
{
	private readonly IRepository<WorkingUnit> workingUnitsRepository;
	public WorkingUnitsController(IRepository<WorkingUnit> workingUnitsRepository)
	{
		this.workingUnitsRepository = workingUnitsRepository;
	}

	[HttpGet]
	public ActionResult<IAsyncEnumerable<WorkingUnit>> GetWorkItems() => Ok(this.workingUnitsRepository.GetAll());

	[HttpGet]
	[Route("{id}")]
	public async Task<ActionResult<WorkingUnit>> GetWorkItem(string id) => Ok(await this.workingUnitsRepository.Get(id));

	[HttpPost]
	[Route("create")]
	public async Task<IActionResult> CreateWorkItem([FromBody] WorkingUnit workItem)
	{
		await this.workingUnitsRepository.Insert(workItem);
		return Ok();
	}

	[HttpPatch]
	[Route("{id}/update")]
	public async Task<IActionResult> UpdateWorkItemById([FromBody] WorkingUnit workItem)
	{
		await this.workingUnitsRepository.Update(workItem);
		return Ok();
	}

	[HttpDelete]
	[Route("{id}/delete")]
	public async Task<IActionResult> DeleteWorkItemById([FromBody] WorkingUnit item)
	{
		await this.workingUnitsRepository.Delete(item);
		return Ok();
	}

}
