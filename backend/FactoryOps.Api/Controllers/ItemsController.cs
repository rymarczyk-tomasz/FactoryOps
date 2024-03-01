using Microsoft.AspNetCore.Mvc;
using FactoryOps.Api.Database.Models;
using FactoryOps.Api.Database.Repositories;

namespace FactoryOps.Api.Controllers;

[ApiController]
[Route("items")]
public class WorkItemsController(IRepository<Item> itemsRepository) : ControllerBase
{
	[HttpGet]
	public ActionResult<IAsyncEnumerable<Item>> GetWorkItems() => Ok(itemsRepository.GetAll());
	
	[HttpGet]
	[Route("{id}")]
	public async Task<ActionResult<Item>> GetWorkItem(int id) => Ok(await itemsRepository.Get(id));

	[HttpPost]
	[Route("create")]
	public async Task<IActionResult> CreateWorkItem([FromBody] Item workItem)
	{
		await itemsRepository.InsertOrUpdate(workItem);
		return Ok();
	}

	[HttpDelete]
	[Route("{id}/delete")]
	public async Task<IActionResult> DeleteWorkItemById([FromBody] Item item)
	{
		await itemsRepository.Delete(item);
		return Ok();
	}
}
