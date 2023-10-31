using Microsoft.AspNetCore.Mvc;
using FactoryOps.Entity.Repositories;
using FactoryOps.Entity.Models;

namespace FactoryOps.Api.Controllers;

[ApiController]
[Route("items")]
public class WorkItemsController : ControllerBase
{
	private readonly IRepository<WorkItem> workItemsRepository;
	public WorkItemsController(IRepository<WorkItem> workItemsRepository)
	{
		this.workItemsRepository = workItemsRepository;
	}

	[HttpGet]
	public ActionResult<IAsyncEnumerable<WorkItem>> GetWorkItems() => Ok(this.workItemsRepository.GetAll());
	
	[HttpGet]
	[Route("{id}")]
	public async Task<ActionResult<WorkItem>> GetWorkItem(string id) => Ok(await this.workItemsRepository.Get(id));

	[HttpPost]
	[Route("create")]
	public async Task<IActionResult> CreateWorkItem([FromBody] WorkItem workItem)
	{
		await this.workItemsRepository.Insert(workItem);
		return Ok();
	}

	[HttpPatch]
	[Route("{id}/update")]
	public async Task<IActionResult> UpdateWorkItemById([FromBody] WorkItem workItem)
	{
		await this.workItemsRepository.Update(workItem);
		return Ok();
	}

	[HttpDelete]
	[Route("{id}/delete")]
	public async Task<IActionResult> DeleteWorkItemById([FromBody] WorkItem item)
	{
		await this.workItemsRepository.Delete(item);
		return Ok();
	}

}
