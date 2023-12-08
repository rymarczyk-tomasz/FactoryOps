using Microsoft.AspNetCore.Mvc;
using FactoryOps.Api.Database.Models;
using FactoryOps.Api.Database.Repositories;

namespace FactoryOps.Api.Controllers;

[ApiController]
[Route("items")]
public class WorkItemsController(IRepository<WorkItem> workItemsRepository) : ControllerBase
{
	[HttpGet]
	public ActionResult<IAsyncEnumerable<WorkItem>> GetWorkItems() => Ok(workItemsRepository.GetAll());
	
	[HttpGet]
	[Route("{id}")]
	public async Task<ActionResult<WorkItem>> GetWorkItem(int id) => Ok(await workItemsRepository.Get(id));

	[HttpPost]
	[Route("create")]
	public async Task<IActionResult> CreateWorkItem([FromBody] WorkItem workItem)
	{
		await workItemsRepository.Insert(workItem);
		return Ok();
	}

	[HttpPatch]
	[Route("{id}/update")]
	public async Task<IActionResult> UpdateWorkItemById([FromBody] WorkItem workItem)
	{
		await workItemsRepository.Update(workItem);
		return Ok();
	}

	[HttpDelete]
	[Route("{id}/delete")]
	public async Task<IActionResult> DeleteWorkItemById([FromBody] WorkItem item)
	{
		await workItemsRepository.Delete(item);
		return Ok();
	}

}
