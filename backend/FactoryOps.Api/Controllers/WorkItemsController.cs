using Microsoft.AspNetCore.Mvc;
using FactoryOps.Domain.Models;
using FactoryOps.Domain.Ports;

namespace FactoryOps.Api.Controllers;

[ApiController]
[Route("items")]
public class WorkItemsController : ControllerBase
{
	private readonly IWorkItemsRepository workItemsRepository;
	public WorkItemsController(IWorkItemsRepository workItemsRepository)
	{
		this.workItemsRepository = workItemsRepository;
	}

	[HttpGet]
	public async Task<ActionResult<IEnumerable<WorkItem>>> GetWorkItems() => Ok(await this.workItemsRepository.GetWorkItems());
	
	[HttpGet]
	[Route("{id}")]
	public async Task<ActionResult<WorkItem>> GetWorkItem(string id) => Ok(await this.workItemsRepository.GetWorkItem(id));

	[HttpPost]
	[Route("create")]
	public async Task<IActionResult> CreateWorkItem([FromBody] WorkItem workItem)
	{
		await this.workItemsRepository.AddWorkItem(workItem);
		return Ok();
	}

	[HttpPatch]
	[Route("update")]
	public async Task<IActionResult> UpdateWorkItemById([FromQuery] string id, [FromBody] WorkItem newWorkItem)
	{
		await this.workItemsRepository.UpdateWorkItem(id, newWorkItem);
		return Ok();
	}

}